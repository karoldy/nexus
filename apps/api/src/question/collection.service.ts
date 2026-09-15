import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, isNull } from 'drizzle-orm';
import { isUniqueViolation, parsePage } from '../knowledge/pagination';
import type { Database } from '../shared/database/client';
import { DRIZZLE } from '../shared/database/database.module';
import { collectionQuestions, collections, questions } from '../shared/database/schema/question';
import { paginated } from '../shared/http/api-response';
import { CollectionListQueryDto, CreateCollectionDto, UpdateCollectionDto } from './dto';
import { QuestionService } from './question.service';

type CollectionRow = typeof collections.$inferSelect;

@Injectable()
export class CollectionService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly questions: QuestionService,
  ) {}

  async list(ownerId: string, query: CollectionListQueryDto) {
    const { page, pageSize, offset } = parsePage(query);
    const filters = [eq(collections.ownerId, ownerId), isNull(collections.deletedAt)];

    if (query.published !== undefined) {
      filters.push(eq(collections.published, query.published));
    }

    const q = query.q?.trim() ?? '';
    if (q) {
      filters.push(ilike(collections.name, `%${q}%`));
    }

    const where = and(...filters);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(collections)
        .where(where)
        .orderBy(desc(collections.updatedAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(collections).where(where),
    ]);

    return paginated(rows, Number(total), page, pageSize);
  }

  async getOwned(ownerId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.id, id),
          eq(collections.ownerId, ownerId),
          isNull(collections.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
    return this.withQuestions(row);
  }

  async create(ownerId: string, dto: CreateCollectionDto) {
    const name = requireName(dto.name);
    const questionIds = dto.questionIds ?? [];
    await this.assertPublishedQuestions(ownerId, questionIds);

    let created: CollectionRow;
    try {
      const [row] = await this.db
        .insert(collections)
        .values({
          id: crypto.randomUUID(),
          ownerId,
          name,
          description: dto.description ?? null,
          published: dto.published ?? false,
        })
        .returning();
      created = row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Collection name already exists');
      }
      throw error;
    }

    await this.syncQuestions(created.id, questionIds);
    return this.getOwned(ownerId, created.id);
  }

  async update(ownerId: string, id: string, dto: UpdateCollectionDto) {
    const current = await this.getOwned(ownerId, id);
    const name = dto.name !== undefined ? requireName(dto.name) : current.name;

    if (dto.questionIds) {
      await this.assertPublishedQuestions(ownerId, dto.questionIds);
    }

    try {
      await this.db
        .update(collections)
        .set({
          name,
          description: dto.description === undefined ? current.description : dto.description,
          published: dto.published ?? current.published,
          updatedAt: new Date(),
        })
        .where(eq(collections.id, id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Collection name already exists');
      }
      throw error;
    }

    if (dto.questionIds) {
      await this.syncQuestions(id, dto.questionIds);
    }
    return this.getOwned(ownerId, id);
  }

  async remove(ownerId: string, id: string) {
    await this.getOwned(ownerId, id);
    const now = new Date();
    await this.db
      .update(collectionQuestions)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(collectionQuestions.collectionId, id), isNull(collectionQuestions.deletedAt)));
    const [deleted] = await this.db
      .update(collections)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(collections.id, id))
      .returning();
    return deleted;
  }

  private async assertPublishedQuestions(ownerId: string, questionIds: string[]) {
    if (new Set(questionIds).size !== questionIds.length) {
      throw new BadRequestException('Duplicate question ids');
    }
    for (const questionId of questionIds) {
      await this.questions.loadPublishedQuestion(ownerId, questionId);
    }
  }

  private async syncQuestions(collectionId: string, questionIds: string[]) {
    const existing = await this.db
      .select()
      .from(collectionQuestions)
      .where(eq(collectionQuestions.collectionId, collectionId));

    const now = new Date();
    const sortById = new Map(questionIds.map((questionId, index) => [questionId, index]));
    const remaining = new Set(questionIds);

    for (const row of existing) {
      const sort = sortById.get(row.questionId);
      if (sort !== undefined) {
        await this.db
          .update(collectionQuestions)
          .set({ deletedAt: null, sort, updatedAt: now })
          .where(eq(collectionQuestions.id, row.id));
        remaining.delete(row.questionId);
      } else if (!row.deletedAt) {
        await this.db
          .update(collectionQuestions)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(collectionQuestions.id, row.id));
      }
    }

    for (const questionId of remaining) {
      await this.db.insert(collectionQuestions).values({
        id: crypto.randomUUID(),
        collectionId,
        questionId,
        sort: sortById.get(questionId) ?? 0,
      });
    }
  }

  private async withQuestions(row: CollectionRow) {
    const members = await this.db
      .select({
        id: questions.id,
        type: questions.type,
        stem: questions.stem,
        published: questions.published,
        sort: collectionQuestions.sort,
      })
      .from(collectionQuestions)
      .innerJoin(questions, eq(collectionQuestions.questionId, questions.id))
      .where(
        and(
          eq(collectionQuestions.collectionId, row.id),
          isNull(collectionQuestions.deletedAt),
          isNull(questions.deletedAt),
        ),
      )
      .orderBy(asc(collectionQuestions.sort));

    return {
      ...row,
      questions: members,
    };
  }
}

function requireName(name: string | undefined): string {
  const value = name?.trim() ?? '';
  if (!value) {
    throw new BadRequestException('Name is required');
  }
  return value.slice(0, 200);
}
