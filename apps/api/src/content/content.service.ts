import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, exists, ilike, inArray, isNull } from 'drizzle-orm';
import { parsePage } from '../knowledge/pagination';
import type { Database } from '../shared/database/client';
import { DRIZZLE } from '../shared/database/database.module';
import { knowledges } from '../shared/database/schema/knowledge';
import { contentKnowledges, contents } from '../shared/database/schema/content';
import { paginated } from '../shared/http/api-response';
import { isContentType, normalizeContentPayload } from './content-payload';
import { ContentListQueryDto, CreateContentDto, UpdateContentDto } from './dto';

type ContentRow = typeof contents.$inferSelect;

@Injectable()
export class ContentService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(ownerId: string, query: ContentListQueryDto) {
    const { page, pageSize, offset } = parsePage(query);
    const filters = [eq(contents.ownerId, ownerId), isNull(contents.deletedAt)];

    if (query.published !== undefined) {
      filters.push(eq(contents.published, query.published));
    }
    if (query.type) {
      filters.push(eq(contents.type, query.type));
    }
    const q = query.q?.trim() ?? '';
    if (q) {
      filters.push(ilike(contents.title, `%${q}%`));
    }
    if (query.knowledgeId) {
      filters.push(
        exists(
          this.db
            .select({ id: contentKnowledges.id })
            .from(contentKnowledges)
            .where(
              and(
                eq(contentKnowledges.contentId, contents.id),
                eq(contentKnowledges.knowledgeId, query.knowledgeId),
                isNull(contentKnowledges.deletedAt),
              ),
            ),
        ),
      );
    }

    const where = and(...filters);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(contents)
        .where(where)
        .orderBy(desc(contents.updatedAt))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(contents).where(where),
    ]);

    const withKnowledges = await this.attachKnowledges(rows);
    return paginated(
      withKnowledges.map((row) => omitPayload(row)),
      Number(total),
      page,
      pageSize,
    );
  }

  async getOwned(ownerId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(contents)
      .where(and(eq(contents.id, id), eq(contents.ownerId, ownerId), isNull(contents.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
    const [withKnowledges] = await this.attachKnowledges([row]);
    return withKnowledges;
  }

  async create(ownerId: string, dto: CreateContentDto) {
    const published = dto.published ?? false;
    const knowledgeIds = dto.knowledgeIds ?? [];
    await this.assertAttachable(ownerId, knowledgeIds, published);
    const normalized = normalizeOrThrow(dto);

    const [created] = await this.db
      .insert(contents)
      .values({
        id: crypto.randomUUID(),
        ownerId,
        type: normalized.type,
        title: normalized.title,
        body: normalized.body,
        summary: normalized.summary,
        url: normalized.url,
        fileKey: normalized.fileKey,
        mimeType: normalized.mimeType,
        fileSize: normalized.fileSize,
        metadata: normalized.metadata,
        published,
      })
      .returning();

    await this.syncKnowledges(created.id, knowledgeIds);
    return this.getOwned(ownerId, created.id);
  }

  async update(ownerId: string, id: string, dto: UpdateContentDto) {
    const current = await this.getOwned(ownerId, id);
    const published = dto.published ?? current.published;
    if (dto.knowledgeIds) {
      await this.assertAttachable(ownerId, dto.knowledgeIds, published);
    }

    const nextType = dto.type ?? current.type;
    if (!isContentType(nextType)) {
      throw new BadRequestException('Invalid content type');
    }
    const normalized = normalizeOrThrow({
      type: nextType,
      title: dto.title ?? current.title,
      body: dto.body !== undefined ? dto.body : current.body,
      summary: dto.summary !== undefined ? dto.summary : current.summary,
      url: dto.url !== undefined ? dto.url : current.url,
      fileKey: dto.fileKey !== undefined ? dto.fileKey : current.fileKey,
      mimeType: dto.mimeType !== undefined ? dto.mimeType : current.mimeType,
      fileSize: dto.fileSize !== undefined ? dto.fileSize : current.fileSize,
      metadata: dto.metadata !== undefined ? dto.metadata : current.metadata,
    });

    await this.db
      .update(contents)
      .set({
        type: normalized.type,
        title: normalized.title,
        body: normalized.body,
        summary: normalized.summary,
        url: normalized.url,
        fileKey: normalized.fileKey,
        mimeType: normalized.mimeType,
        fileSize: normalized.fileSize,
        metadata: normalized.metadata,
        published,
        updatedAt: new Date(),
      })
      .where(eq(contents.id, id));

    if (dto.knowledgeIds) {
      await this.syncKnowledges(id, dto.knowledgeIds);
    }
    return this.getOwned(ownerId, id);
  }

  async remove(ownerId: string, id: string) {
    await this.getOwned(ownerId, id);
    const now = new Date();
    await this.db
      .update(contentKnowledges)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(contentKnowledges.contentId, id), isNull(contentKnowledges.deletedAt)));
    const [deleted] = await this.db
      .update(contents)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(contents.id, id))
      .returning();
    return omitPayload(deleted);
  }

  private async assertAttachable(ownerId: string, knowledgeIds: string[], published: boolean) {
    if (knowledgeIds.length === 0) {
      return;
    }
    if (!published) {
      throw new BadRequestException('Draft contents cannot attach knowledge');
    }
    const unique = [...new Set(knowledgeIds)];
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

  private async syncKnowledges(contentId: string, knowledgeIds: string[]) {
    const unique = [...new Set(knowledgeIds)];
    const existing = await this.db
      .select()
      .from(contentKnowledges)
      .where(eq(contentKnowledges.contentId, contentId));
    const now = new Date();
    const wanted = new Set(unique);

    for (const row of existing) {
      if (wanted.has(row.knowledgeId)) {
        if (row.deletedAt) {
          await this.db
            .update(contentKnowledges)
            .set({ deletedAt: null, updatedAt: now })
            .where(eq(contentKnowledges.id, row.id));
        }
        wanted.delete(row.knowledgeId);
      } else if (!row.deletedAt) {
        await this.db
          .update(contentKnowledges)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(contentKnowledges.id, row.id));
      }
    }

    for (const knowledgeId of wanted) {
      await this.db.insert(contentKnowledges).values({
        id: crypto.randomUUID(),
        contentId,
        knowledgeId,
      });
    }
  }

  private async attachKnowledges(rows: ContentRow[]) {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const links = await this.db
      .select({
        contentId: contentKnowledges.contentId,
        id: knowledges.id,
        title: knowledges.title,
      })
      .from(contentKnowledges)
      .innerJoin(knowledges, eq(contentKnowledges.knowledgeId, knowledges.id))
      .where(
        and(
          inArray(contentKnowledges.contentId, ids),
          isNull(contentKnowledges.deletedAt),
          isNull(knowledges.deletedAt),
        ),
      );

    const byContent = new Map<string, { id: string; title: string }[]>();
    for (const link of links) {
      const list = byContent.get(link.contentId) ?? [];
      list.push({ id: link.id, title: link.title });
      byContent.set(link.contentId, list);
    }

    return rows.map((row) => ({
      ...row,
      knowledges: byContent.get(row.id) ?? [],
    }));
  }
}

function omitPayload<
  T extends { body: unknown; url: unknown; fileKey: unknown; mimeType: unknown; fileSize: unknown },
>(row: T) {
  const {
    body: _body,
    url: _url,
    fileKey: _fileKey,
    mimeType: _mimeType,
    fileSize: _fileSize,
    ...rest
  } = row;
  return rest;
}

function normalizeOrThrow(input: Parameters<typeof normalizeContentPayload>[0]) {
  try {
    return normalizeContentPayload(input);
  } catch (error) {
    throw new BadRequestException(error instanceof Error ? error.message : 'Invalid content');
  }
}
