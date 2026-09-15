import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, isNull } from 'drizzle-orm';
import type { Database } from '../shared/database/client';
import { DRIZZLE } from '../shared/database/database.module';
import { paginated } from '../shared/http/api-response';
import { tags } from '../shared/database/schema/knowledge';
import { CreateTagDto, PageQueryDto, UpdateTagDto } from './dto';
import { isUniqueViolation, parsePage } from './pagination';

@Injectable()
export class TagService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(ownerId: string, query: PageQueryDto) {
    const { page, pageSize, offset } = parsePage(query);
    const where = and(eq(tags.ownerId, ownerId), isNull(tags.deletedAt));
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(tags)
        .where(where)
        .orderBy(asc(tags.name))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(tags).where(where),
    ]);
    return paginated(rows, Number(total), page, pageSize);
  }

  async getOwned(ownerId: string, id: string) {
    const [row] = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.ownerId, ownerId), isNull(tags.deletedAt)))
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
    return row;
  }

  async create(ownerId: string, dto: CreateTagDto) {
    const name = requireTagName(dto.name);
    try {
      const [created] = await this.db
        .insert(tags)
        .values({ id: crypto.randomUUID(), ownerId, name })
        .returning();
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Tag name already exists');
      }
      throw error;
    }
  }

  async update(ownerId: string, id: string, dto: UpdateTagDto) {
    await this.getOwned(ownerId, id);
    const name = requireTagName(dto.name);
    try {
      const [updated] = await this.db
        .update(tags)
        .set({ name, updatedAt: new Date() })
        .where(eq(tags.id, id))
        .returning();
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Tag name already exists');
      }
      throw error;
    }
  }

  async remove(ownerId: string, id: string) {
    await this.getOwned(ownerId, id);
    const [deleted] = await this.db
      .update(tags)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(tags.id, id))
      .returning();
    return deleted;
  }
}

function requireTagName(name: string | undefined): string {
  const value = name?.trim() ?? '';
  if (!value) {
    throw new BadRequestException('Name is required');
  }
  return value.slice(0, 50);
}
