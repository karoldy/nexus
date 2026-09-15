import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, exists, ilike, inArray, isNull } from 'drizzle-orm';
import { parsePage } from '../knowledge/pagination';
import type { Database } from '../shared/database/client';
import { DRIZZLE } from '../shared/database/database.module';
import { knowledges } from '../shared/database/schema/knowledge';
import {
  collectionQuestions,
  collections,
  questionKnowledges,
  questions,
} from '../shared/database/schema/question';
import { paginated } from '../shared/http/api-response';
import { CreateQuestionDto, QuestionListQueryDto, UpdateQuestionDto } from './dto';
import { normalizeQuestionPayload } from './question-payload';

type QuestionRow = typeof questions.$inferSelect;

@Injectable()
export class QuestionService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(ownerId: string, query: QuestionListQueryDto) {
    const { page, pageSize, offset } = parsePage(query);
    const filters = [eq(questions.ownerId, ownerId), isNull(questions.deletedAt)];

    if (query.published !== undefined) {
      filters.push(eq(questions.published, query.published));
    }

    if (query.type) {
      filters.push(eq(questions.type, query.type));
    }

    const q = query.q?.trim() ?? '';
    if (q) {
      filters.push(ilike(questions.stem, `%${q}%`));
    }

    if (query.knowledgeId) {
      filters.push(
        exists(
          this.db
            .select({ id: questionKnowledges.id })
            .from(questionKnowledges)
            .where(
              and(
                eq(questionKnowledges.questionId, questions.id),
                eq(questionKnowledges.knowledgeId, query.knowledgeId),
                isNull(questionKnowledges.deletedAt),
              ),
            ),
        ),
      );
    }

    if (query.collectionId) {
      await this.assertOwnedCollection(ownerId, query.collectionId);
      filters.push(
        exists(
          this.db
            .select({ id: collectionQuestions.id })
            .from(collectionQuestions)
            .where(
              and(
                eq(collectionQuestions.questionId, questions.id),
                eq(collectionQuestions.collectionId, query.collectionId),
                isNull(collectionQuestions.deletedAt),
              ),
            ),
        ),
      );
    }

    const where = and(...filters);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(questions)
        .where(where)
        .orderBy(desc(questions.updatedAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(questions).where(where),
    ]);

    const withKnowledges = await this.attachKnowledges(rows);
    return paginated(
      withKnowledges.map((row) => omitAnswer(row)),
      Number(total),
      page,
      pageSize,
    );
  }

  async getOwned(ownerId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(questions)
      .where(and(eq(questions.id, id), eq(questions.ownerId, ownerId), isNull(questions.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
    const [withKnowledges] = await this.attachKnowledges([row]);
    return withKnowledges;
  }

  async create(ownerId: string, dto: CreateQuestionDto) {
    const published = dto.published ?? false;
    const knowledgeIds = dto.knowledgeIds ?? [];
    await this.assertAttachable(ownerId, knowledgeIds, published);

    const normalized = normalizeOrThrow({
      type: dto.type,
      stem: dto.stem,
      options: dto.options,
      answer: dto.answer,
      explanation: dto.explanation,
      difficulty: dto.difficulty,
    });

    const [created] = await this.db
      .insert(questions)
      .values({
        id: crypto.randomUUID(),
        ownerId,
        type: normalized.type,
        stem: normalized.stem,
        options: normalized.options,
        answer: normalized.answer,
        explanation: normalized.explanation,
        difficulty: normalized.difficulty,
        published,
      })
      .returning();

    await this.syncKnowledges(created.id, knowledgeIds);
    return this.getOwned(ownerId, created.id);
  }

  async update(ownerId: string, id: string, dto: UpdateQuestionDto) {
    const current = await this.getOwned(ownerId, id);

    if (dto.type !== undefined && dto.type !== current.type) {
      if (dto.options === undefined || dto.answer === undefined) {
        throw new BadRequestException('Changing type requires options and answer');
      }
    }

    const published = dto.published ?? current.published;
    if (dto.knowledgeIds) {
      await this.assertAttachable(ownerId, dto.knowledgeIds, published);
    }

    const normalized = normalizeOrThrow({
      type: dto.type ?? current.type,
      stem: dto.stem ?? current.stem,
      options: dto.options !== undefined ? dto.options : current.options,
      answer: dto.answer !== undefined ? dto.answer : current.answer,
      explanation: dto.explanation !== undefined ? dto.explanation : current.explanation,
      difficulty: dto.difficulty !== undefined ? dto.difficulty : current.difficulty,
    });

    await this.db
      .update(questions)
      .set({
        type: normalized.type,
        stem: normalized.stem,
        options: normalized.options,
        answer: normalized.answer,
        explanation: normalized.explanation,
        difficulty: normalized.difficulty,
        published,
        updatedAt: new Date(),
      })
      .where(eq(questions.id, id));

    if (dto.knowledgeIds) {
      await this.syncKnowledges(id, dto.knowledgeIds);
    }
    return this.getOwned(ownerId, id);
  }

  async remove(ownerId: string, id: string) {
    await this.getOwned(ownerId, id);
    const now = new Date();
    await this.db
      .update(questionKnowledges)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(questionKnowledges.questionId, id), isNull(questionKnowledges.deletedAt)));
    const [deleted] = await this.db
      .update(questions)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(questions.id, id))
      .returning();
    return deleted;
  }

  private async assertAttachable(ownerId: string, knowledgeIds: string[], published: boolean) {
    if (knowledgeIds.length === 0) {
      return;
    }
    if (!published) {
      throw new BadRequestException('Draft questions cannot attach knowledge');
    }
    await this.assertPublishedKnowledges(ownerId, knowledgeIds);
  }

  private async assertPublishedKnowledges(ownerId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    for (const knowledgeId of unique) {
      const [row] = await this.db
        .select()
        .from(knowledges)
        .where(
          and(
            eq(knowledges.id, knowledgeId),
            eq(knowledges.ownerId, ownerId),
            isNull(knowledges.deletedAt),
          ),
        )
        .limit(1);
      if (!row) {
        throw new NotFoundException();
      }
      if (row.published === false) {
        throw new BadRequestException('Knowledge must be published');
      }
    }
  }

  private async assertOwnedCollection(ownerId: string, collectionId: string) {
    const [row] = await this.db
      .select({ id: collections.id })
      .from(collections)
      .where(
        and(
          eq(collections.id, collectionId),
          eq(collections.ownerId, ownerId),
          isNull(collections.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
  }

  private async syncKnowledges(questionId: string, knowledgeIds: string[]) {
    const unique = [...new Set(knowledgeIds)];
    const existing = await this.db
      .select()
      .from(questionKnowledges)
      .where(eq(questionKnowledges.questionId, questionId));

    const now = new Date();
    const wanted = new Set(unique);

    for (const row of existing) {
      if (wanted.has(row.knowledgeId)) {
        if (row.deletedAt) {
          await this.db
            .update(questionKnowledges)
            .set({ deletedAt: null, updatedAt: now })
            .where(eq(questionKnowledges.id, row.id));
        }
        wanted.delete(row.knowledgeId);
      } else if (!row.deletedAt) {
        await this.db
          .update(questionKnowledges)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(questionKnowledges.id, row.id));
      }
    }

    for (const knowledgeId of wanted) {
      await this.db.insert(questionKnowledges).values({
        id: crypto.randomUUID(),
        questionId,
        knowledgeId,
      });
    }
  }

  private async attachKnowledges(rows: QuestionRow[]) {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const links = await this.db
      .select({
        questionId: questionKnowledges.questionId,
        id: knowledges.id,
        title: knowledges.title,
      })
      .from(questionKnowledges)
      .innerJoin(knowledges, eq(questionKnowledges.knowledgeId, knowledges.id))
      .where(
        and(
          inArray(questionKnowledges.questionId, ids),
          isNull(questionKnowledges.deletedAt),
          isNull(knowledges.deletedAt),
        ),
      );

    const byQuestion = new Map<string, { id: string; title: string }[]>();
    for (const link of links) {
      const list = byQuestion.get(link.questionId) ?? [];
      list.push({ id: link.id, title: link.title });
      byQuestion.set(link.questionId, list);
    }

    return rows.map((row) => ({
      ...row,
      knowledges: byQuestion.get(row.id) ?? [],
    }));
  }
}

function omitAnswer<T extends { answer: unknown }>(row: T) {
  const { answer: _answer, ...rest } = row;
  return rest;
}

function normalizeOrThrow(input: Parameters<typeof normalizeQuestionPayload>[0]) {
  try {
    return normalizeQuestionPayload(input);
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Invalid question');
  }
}
