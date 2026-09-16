import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import { isUniqueViolation, parsePage } from '../knowledge/pagination';
import { QuestionService } from '../question/question.service';
import type { Database } from '../shared/database/client';
import { DRIZZLE } from '../shared/database/database.module';
import { examAnswers, examQuestions, examRecords, exams } from '../shared/database/schema/exam';
import { questions } from '../shared/database/schema/question';
import { paginated } from '../shared/http/api-response';
import {
  CreateExamDto,
  ExamListQueryDto,
  ExamQuestionItemDto,
  ExamRecordListQueryDto,
  SaveExamAnswersDto,
  UpdateExamDto,
} from './dto';
import { isAnswerCorrect, toScoreNumber } from './exam-grade';

type ExamRow = typeof exams.$inferSelect;
type RecordRow = typeof examRecords.$inferSelect;
type AnswerRow = typeof examAnswers.$inferSelect;

const IN_PROGRESS = 'IN_PROGRESS';
const SUBMITTED = 'SUBMITTED';
const TIMEOUT = 'TIMEOUT';

@Injectable()
export class ExamService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly questionService: QuestionService,
  ) {}

  async list(ownerId: string, query: ExamListQueryDto) {
    const { page, pageSize, offset } = parsePage(query);
    const filters = [eq(exams.ownerId, ownerId), isNull(exams.deletedAt)];

    if (query.published !== undefined) {
      filters.push(eq(exams.published, query.published));
    }

    const q = query.q?.trim() ?? '';
    if (q) {
      filters.push(ilike(exams.title, `%${q}%`));
    }

    const where = and(...filters);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(exams)
        .where(where)
        .orderBy(desc(exams.updatedAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(exams).where(where),
    ]);

    return paginated(rows, Number(total), page, pageSize);
  }

  async getOwned(ownerId: string, id: string) {
    const row = await this.loadExam(ownerId, id);
    return this.withQuestions(row);
  }

  async create(ownerId: string, dto: CreateExamDto) {
    const title = requireTitle(dto.title);
    const members = dto.questions ?? [];
    await this.assertPublishedQuestions(ownerId, members);

    let created: ExamRow;
    try {
      const [row] = await this.db
        .insert(exams)
        .values({
          id: crypto.randomUUID(),
          ownerId,
          title,
          description: dto.description ?? null,
          durationSeconds: dto.durationSeconds ?? null,
          published: dto.published ?? false,
        })
        .returning();
      created = row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Exam title already exists');
      }
      throw error;
    }

    await this.syncQuestions(created.id, members);
    return this.getOwned(ownerId, created.id);
  }

  async update(ownerId: string, id: string, dto: UpdateExamDto) {
    const current = await this.getOwned(ownerId, id);
    const title = dto.title !== undefined ? requireTitle(dto.title) : current.title;

    if (dto.questions) {
      await this.assertPublishedQuestions(ownerId, dto.questions);
    }

    try {
      await this.db
        .update(exams)
        .set({
          title,
          description: dto.description === undefined ? current.description : dto.description,
          durationSeconds:
            dto.durationSeconds === undefined ? current.durationSeconds : dto.durationSeconds,
          published: dto.published ?? current.published,
          updatedAt: new Date(),
        })
        .where(eq(exams.id, id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Exam title already exists');
      }
      throw error;
    }

    if (dto.questions) {
      await this.syncQuestions(id, dto.questions);
    }
    return this.getOwned(ownerId, id);
  }

  async remove(ownerId: string, id: string) {
    await this.loadExam(ownerId, id);
    const now = new Date();
    await this.db
      .update(examQuestions)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(examQuestions.examId, id), isNull(examQuestions.deletedAt)));
    const [deleted] = await this.db
      .update(exams)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(exams.id, id))
      .returning();
    return deleted;
  }

  async start(ownerId: string, examId: string) {
    const exam = await this.loadExam(ownerId, examId);
    if (!exam.published) {
      throw new BadRequestException('Draft exams cannot be started');
    }

    const existing = await this.findInProgress(examId, ownerId);
    if (existing) {
      return this.getRecord(ownerId, existing.id);
    }

    const paper = await this.loadPaperQuestions(examId);
    if (paper.length === 0) {
      throw new BadRequestException('Exam has no questions');
    }

    await this.db
      .update(examRecords)
      .set({ status: false, updatedAt: new Date() })
      .where(
        and(
          eq(examRecords.examId, examId),
          eq(examRecords.userId, ownerId),
          isNull(examRecords.deletedAt),
        ),
      );

    const recordId = crypto.randomUUID();
    const startedAt = new Date();
    try {
      await this.db.insert(examRecords).values({
        id: recordId,
        examId,
        userId: ownerId,
        progress: IN_PROGRESS,
        status: true,
        startedAt,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.findInProgress(examId, ownerId);
        if (raced) {
          return this.getRecord(ownerId, raced.id);
        }
      }
      throw error;
    }

    await this.db.insert(examAnswers).values(
      paper.map((item) => ({
        id: crypto.randomUUID(),
        recordId,
        questionId: item.questionId,
        typeSnapshot: item.type,
        stemSnapshot: item.stem,
        optionsSnapshot: item.options,
        answerSnapshot: item.answer,
        submittedAnswer: null,
        maxScore: item.score,
      })),
    );

    return this.getRecord(ownerId, recordId);
  }

  async listRecords(ownerId: string, query: ExamRecordListQueryDto) {
    const { page, pageSize, offset } = parsePage(query);
    const filters = [eq(examRecords.userId, ownerId), isNull(examRecords.deletedAt)];
    if (query.examId) {
      filters.push(eq(examRecords.examId, query.examId));
    }
    const where = and(...filters);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(examRecords)
        .where(where)
        .orderBy(desc(examRecords.startedAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(examRecords).where(where),
    ]);

    return paginated(
      rows.map((row) => this.serializeRecord(row)),
      Number(total),
      page,
      pageSize,
    );
  }

  async getRecord(ownerId: string, recordId: string) {
    const record = await this.loadRecord(ownerId, recordId);
    const finalized = await this.expireIfNeeded(record);
    return this.withAnswers(finalized);
  }

  async saveAnswers(ownerId: string, recordId: string, dto: SaveExamAnswersDto) {
    const record = await this.expireIfNeeded(await this.loadRecord(ownerId, recordId));
    if (record.progress !== IN_PROGRESS) {
      throw new BadRequestException('Exam record is not in progress');
    }

    const answers = await this.loadAnswers(recordId);
    const byQuestion = new Map(answers.map((row) => [row.questionId, row]));
    const now = new Date();

    for (const item of dto.answers) {
      const row = byQuestion.get(item.questionId);
      if (!row) {
        throw new BadRequestException('Unknown question on this exam record');
      }
      await this.db
        .update(examAnswers)
        .set({
          submittedAnswer: item.submittedAnswer ?? null,
          updatedAt: now,
        })
        .where(eq(examAnswers.id, row.id));
    }

    return this.getRecord(ownerId, recordId);
  }

  async submit(ownerId: string, recordId: string) {
    const record = await this.expireIfNeeded(await this.loadRecord(ownerId, recordId));
    if (record.progress !== IN_PROGRESS) {
      return this.withAnswers(record);
    }
    const finalized = await this.finalize(record, SUBMITTED);
    return this.withAnswers(finalized);
  }

  private async expireIfNeeded(record: RecordRow): Promise<RecordRow> {
    if (record.progress !== IN_PROGRESS) {
      return record;
    }
    const exam = await this.loadExamById(record.examId);
    if (!exam?.durationSeconds) {
      return record;
    }
    const deadline = record.startedAt.getTime() + exam.durationSeconds * 1000;
    if (Date.now() <= deadline) {
      return record;
    }
    return this.finalize(record, TIMEOUT);
  }

  private async finalize(record: RecordRow, progress: typeof SUBMITTED | typeof TIMEOUT) {
    const answers = await this.loadAnswers(record.id);
    let total = 0;
    let earned = 0;
    const now = new Date();

    for (const answer of answers) {
      const maxScore = toScoreNumber(answer.maxScore) ?? 0;
      total += maxScore;
      const correct = isAnswerCorrect(
        answer.typeSnapshot,
        answer.answerSnapshot,
        answer.submittedAnswer,
      );
      const score = correct ? maxScore : 0;
      earned += score;
      await this.db
        .update(examAnswers)
        .set({
          isCorrect: correct,
          score: score.toFixed(2),
          updatedAt: now,
        })
        .where(eq(examAnswers.id, answer.id));
    }

    const [updated] = await this.db
      .update(examRecords)
      .set({
        progress,
        submittedAt: now,
        totalScore: total.toFixed(2),
        earnedScore: earned.toFixed(2),
        updatedAt: now,
      })
      .where(eq(examRecords.id, record.id))
      .returning();

    return updated;
  }

  private async loadExam(ownerId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(exams)
      .where(and(eq(exams.id, id), eq(exams.ownerId, ownerId), isNull(exams.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
    return row;
  }

  private async loadExamById(id: string) {
    const [row] = await this.db.select().from(exams).where(eq(exams.id, id)).limit(1);
    return row ?? null;
  }

  private async findInProgress(examId: string, userId: string) {
    const [row] = await this.db
      .select()
      .from(examRecords)
      .where(
        and(
          eq(examRecords.examId, examId),
          eq(examRecords.userId, userId),
          eq(examRecords.progress, IN_PROGRESS),
          isNull(examRecords.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  private async loadRecord(ownerId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(examRecords)
      .where(
        and(eq(examRecords.id, id), eq(examRecords.userId, ownerId), isNull(examRecords.deletedAt)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
    return row;
  }

  private async assertPublishedQuestions(ownerId: string, members: ExamQuestionItemDto[]) {
    const ids = members.map((item) => item.questionId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate question ids');
    }
    for (const item of members) {
      await this.questionService.loadPublishedQuestion(ownerId, item.questionId);
    }
  }

  private async syncQuestions(examId: string, members: ExamQuestionItemDto[]) {
    const existing = await this.db
      .select()
      .from(examQuestions)
      .where(eq(examQuestions.examId, examId));
    const now = new Date();
    const byId = new Map(members.map((item, index) => [item.questionId, { item, sort: index }]));
    const remaining = new Set(members.map((item) => item.questionId));

    for (const row of existing) {
      const next = byId.get(row.questionId);
      if (next) {
        await this.db
          .update(examQuestions)
          .set({
            deletedAt: null,
            sort: next.sort,
            score: (next.item.score ?? 1).toFixed(2),
            updatedAt: now,
          })
          .where(eq(examQuestions.id, row.id));
        remaining.delete(row.questionId);
      } else if (!row.deletedAt) {
        await this.db
          .update(examQuestions)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(examQuestions.id, row.id));
      }
    }

    for (const questionId of remaining) {
      const next = byId.get(questionId);
      await this.db.insert(examQuestions).values({
        id: crypto.randomUUID(),
        examId,
        questionId,
        sort: next?.sort ?? 0,
        score: (next?.item.score ?? 1).toFixed(2),
      });
    }
  }

  private async withQuestions(row: ExamRow) {
    const members = await this.db
      .select({
        id: questions.id,
        type: questions.type,
        stem: questions.stem,
        published: questions.published,
        sort: examQuestions.sort,
        score: examQuestions.score,
      })
      .from(examQuestions)
      .innerJoin(questions, eq(examQuestions.questionId, questions.id))
      .where(
        and(
          eq(examQuestions.examId, row.id),
          isNull(examQuestions.deletedAt),
          isNull(questions.deletedAt),
        ),
      )
      .orderBy(asc(examQuestions.sort));

    return {
      ...row,
      questions: members.map((item) => ({
        ...item,
        score: toScoreNumber(item.score) ?? 1,
      })),
    };
  }

  private async loadPaperQuestions(examId: string) {
    return this.db
      .select({
        questionId: questions.id,
        type: questions.type,
        stem: questions.stem,
        options: questions.options,
        answer: questions.answer,
        score: examQuestions.score,
      })
      .from(examQuestions)
      .innerJoin(questions, eq(examQuestions.questionId, questions.id))
      .where(and(eq(examQuestions.examId, examId), isNull(examQuestions.deletedAt)))
      .orderBy(asc(examQuestions.sort));
  }

  private async loadAnswers(recordId: string) {
    return this.db
      .select()
      .from(examAnswers)
      .where(and(eq(examAnswers.recordId, recordId), isNull(examAnswers.deletedAt)))
      .orderBy(asc(examAnswers.createdAt));
  }

  private async withAnswers(record: RecordRow) {
    const exam = await this.loadExamById(record.examId);
    const answers = await this.loadAnswers(record.id);
    const revealKey = record.progress !== IN_PROGRESS;
    return {
      ...this.serializeRecord(record),
      examTitle: exam?.title ?? null,
      durationSeconds: exam?.durationSeconds ?? null,
      answers: answers.map((answer) => this.serializeAnswer(answer, revealKey)),
    };
  }

  private serializeRecord(row: RecordRow) {
    return {
      ...row,
      totalScore: toScoreNumber(row.totalScore),
      earnedScore: toScoreNumber(row.earnedScore),
    };
  }

  private serializeAnswer(row: AnswerRow, revealKey: boolean) {
    return {
      id: row.id,
      questionId: row.questionId,
      type: row.typeSnapshot,
      stem: row.stemSnapshot,
      options: row.optionsSnapshot,
      blankCount:
        row.typeSnapshot === 'FILL_BLANK' &&
        row.answerSnapshot &&
        Array.isArray((row.answerSnapshot as { blanks?: unknown }).blanks)
          ? ((row.answerSnapshot as { blanks: unknown[] }).blanks.length as number)
          : null,
      submittedAnswer: row.submittedAnswer,
      isCorrect: row.isCorrect,
      maxScore: toScoreNumber(row.maxScore),
      score: toScoreNumber(row.score),
      ...(revealKey ? { answer: row.answerSnapshot } : {}),
    };
  }
}

function requireTitle(title: string | undefined): string {
  const value = title?.trim() ?? '';
  if (!value) {
    throw new BadRequestException('Title is required');
  }
  return value.slice(0, 200);
}
