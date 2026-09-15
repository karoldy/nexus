import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, exists, ilike, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../shared/database/client';
import { DRIZZLE } from '../shared/database/database.module';
import { paginated } from '../shared/http/api-response';
import { categories, knowledgeTags, knowledges, tags } from '../shared/database/schema/knowledge';
import { CreateKnowledgeDto, KnowledgeListQueryDto, UpdateKnowledgeDto } from './dto';
import { parsePage } from './pagination';
import { CategoryService } from './category.service';
import { TagService } from './tag.service';

@Injectable()
export class KnowledgeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly categories: CategoryService,
    private readonly tags: TagService,
  ) {}

  async list(ownerId: string, query: KnowledgeListQueryDto) {
    const { page, pageSize, offset } = parsePage(query);
    const filters = [eq(knowledges.ownerId, ownerId), isNull(knowledges.deletedAt)];

    if (query.categoryId) {
      filters.push(eq(knowledges.categoryId, query.categoryId));
    }

    if (query.published !== undefined) {
      filters.push(eq(knowledges.published, query.published));
    }

    const q = query.q?.trim() ?? '';
    if (q) {
      filters.push(ilike(knowledges.title, `%${q}%`));
    }

    if (query.tagId) {
      filters.push(
        exists(
          this.db
            .select({ id: knowledgeTags.id })
            .from(knowledgeTags)
            .where(
              and(
                eq(knowledgeTags.knowledgeId, knowledges.id),
                eq(knowledgeTags.tagId, query.tagId),
                isNull(knowledgeTags.deletedAt),
              ),
            ),
        ),
      );
    }

    const where = and(...filters);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(knowledges)
        .where(where)
        .orderBy(desc(knowledges.updatedAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(knowledges).where(where),
    ]);

    const withTags = await this.attachTags(rows);
    return paginated(withTags, Number(total), page, pageSize);
  }

  async getOwned(ownerId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(knowledges)
      .where(
        and(eq(knowledges.id, id), eq(knowledges.ownerId, ownerId), isNull(knowledges.deletedAt)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
    const [withTags] = await this.attachTags([row]);
    return withTags;
  }

  async create(ownerId: string, dto: CreateKnowledgeDto) {
    const title = requireTitle(dto.title);
    const categoryId = await this.resolveCategory(ownerId, dto.categoryId ?? null);
    const tagIds = dto.tagIds ?? [];
    await this.assertTags(ownerId, tagIds);

    const [created] = await this.db
      .insert(knowledges)
      .values({
        id: crypto.randomUUID(),
        ownerId,
        categoryId,
        title,
        summary: dto.summary ?? null,
        body: dto.body ?? null,
        published: dto.published ?? false,
      })
      .returning();

    await this.syncTags(created.id, tagIds);
    return this.getOwned(ownerId, created.id);
  }

  async update(ownerId: string, id: string, dto: UpdateKnowledgeDto) {
    const current = await this.getOwned(ownerId, id);
    const title = dto.title !== undefined ? requireTitle(dto.title) : current.title;
    const categoryId =
      dto.categoryId === undefined
        ? current.categoryId
        : await this.resolveCategory(ownerId, dto.categoryId);

    if (dto.tagIds) {
      await this.assertTags(ownerId, dto.tagIds);
    }

    await this.db
      .update(knowledges)
      .set({
        title,
        summary: dto.summary === undefined ? current.summary : dto.summary,
        body: dto.body === undefined ? current.body : dto.body,
        categoryId,
        published: dto.published ?? current.published,
        updatedAt: new Date(),
      })
      .where(eq(knowledges.id, id));

    if (dto.tagIds) {
      await this.syncTags(id, dto.tagIds);
    }
    return this.getOwned(ownerId, id);
  }

  async remove(ownerId: string, id: string) {
    await this.getOwned(ownerId, id);
    const now = new Date();
    await this.db
      .update(knowledgeTags)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(knowledgeTags.knowledgeId, id), isNull(knowledgeTags.deletedAt)));
    const [deleted] = await this.db
      .update(knowledges)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(knowledges.id, id))
      .returning();
    return deleted;
  }

  private async resolveCategory(ownerId: string, categoryId: string | null) {
    if (!categoryId) {
      return null;
    }
    const category = await this.categories.getOwned(ownerId, categoryId);
    return category.id;
  }

  private async assertTags(ownerId: string, tagIds: string[]) {
    const unique = [...new Set(tagIds)];
    for (const tagId of unique) {
      await this.tags.getOwned(ownerId, tagId);
    }
  }

  private async syncTags(knowledgeId: string, tagIds: string[]) {
    const unique = [...new Set(tagIds)];
    const existing = await this.db
      .select()
      .from(knowledgeTags)
      .where(eq(knowledgeTags.knowledgeId, knowledgeId));

    const now = new Date();
    const wanted = new Set(unique);

    for (const row of existing) {
      if (wanted.has(row.tagId)) {
        if (row.deletedAt) {
          await this.db
            .update(knowledgeTags)
            .set({ deletedAt: null, updatedAt: now })
            .where(eq(knowledgeTags.id, row.id));
        }
        wanted.delete(row.tagId);
      } else if (!row.deletedAt) {
        await this.db
          .update(knowledgeTags)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(knowledgeTags.id, row.id));
      }
    }

    for (const tagId of wanted) {
      await this.db.insert(knowledgeTags).values({
        id: crypto.randomUUID(),
        knowledgeId,
        tagId,
      });
    }
  }

  private async attachTags(rows: (typeof knowledges.$inferSelect)[]) {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const links = await this.db
      .select({
        knowledgeId: knowledgeTags.knowledgeId,
        tag: tags,
      })
      .from(knowledgeTags)
      .innerJoin(tags, eq(knowledgeTags.tagId, tags.id))
      .where(
        and(
          inArray(knowledgeTags.knowledgeId, ids),
          isNull(knowledgeTags.deletedAt),
          isNull(tags.deletedAt),
        ),
      );

    const byKnowledge = new Map<string, (typeof tags.$inferSelect)[]>();
    for (const link of links) {
      const list = byKnowledge.get(link.knowledgeId) ?? [];
      list.push(link.tag);
      byKnowledge.set(link.knowledgeId, list);
    }

    const categoryIds = [
      ...new Set(rows.map((row) => row.categoryId).filter((id): id is string => Boolean(id))),
    ];
    const categoryRows =
      categoryIds.length === 0
        ? []
        : await this.db
            .select()
            .from(categories)
            .where(and(inArray(categories.id, categoryIds), isNull(categories.deletedAt)));
    const categoryById = new Map(categoryRows.map((row) => [row.id, row]));

    return rows.map((row) => ({
      ...row,
      category: row.categoryId ? (categoryById.get(row.categoryId) ?? null) : null,
      tags: byKnowledge.get(row.id) ?? [],
    }));
  }
}

function requireTitle(title: string | undefined): string {
  const value = title?.trim() ?? '';
  if (!value) {
    throw new BadRequestException('Title is required');
  }
  return value.slice(0, 200);
}
