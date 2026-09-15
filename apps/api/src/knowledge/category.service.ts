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
import { categories } from '../shared/database/schema/knowledge';
import { CreateCategoryDto, PageQueryDto, UpdateCategoryDto } from './dto';
import { isUniqueViolation, parsePage, slugify } from './pagination';

export type CategoryRow = typeof categories.$inferSelect;

export type CategoryTreeNode = CategoryRow & { children: CategoryTreeNode[] };

@Injectable()
export class CategoryService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async list(ownerId: string, query: PageQueryDto) {
    const { page, pageSize, offset } = parsePage(query);
    const where = and(eq(categories.ownerId, ownerId), isNull(categories.deletedAt));

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(categories)
        .where(where)
        .orderBy(asc(categories.sort), asc(categories.name))
        .limit(pageSize)
        .offset(offset),
      this.db.select({ total: count() }).from(categories).where(where),
    ]);

    return paginated(rows, Number(total), page, pageSize);
  }

  async tree(ownerId: string): Promise<CategoryTreeNode[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.ownerId, ownerId), isNull(categories.deletedAt)))
      .orderBy(asc(categories.sort), asc(categories.name));

    const byId = new Map<string, CategoryTreeNode>();
    for (const row of rows) {
      byId.set(row.id, { ...row, children: [] });
    }

    const roots: CategoryTreeNode[] = [];
    for (const node of byId.values()) {
      if (node.parentId && byId.has(node.parentId)) {
        byId.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  async getOwned(ownerId: string, id: string): Promise<CategoryRow> {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(
        and(eq(categories.id, id), eq(categories.ownerId, ownerId), isNull(categories.deletedAt)),
      )
      .limit(1);
    if (!row) {
      throw new NotFoundException();
    }
    return row;
  }

  async create(ownerId: string, dto: CreateCategoryDto) {
    const name = requireName(dto.name);
    const slug = dto.slug?.trim() ? slugify(dto.slug) : slugify(name);
    const parentId = await this.resolveParent(ownerId, dto.parentId ?? null);

    try {
      const [created] = await this.db
        .insert(categories)
        .values({
          id: crypto.randomUUID(),
          ownerId,
          parentId,
          name,
          slug,
          description: dto.description ?? null,
          sort: dto.sort ?? 0,
        })
        .returning();
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Category slug already exists at this level');
      }
      throw error;
    }
  }

  async update(ownerId: string, id: string, dto: UpdateCategoryDto) {
    const current = await this.getOwned(ownerId, id);
    const name = dto.name !== undefined ? requireName(dto.name) : current.name;
    const slug =
      dto.slug !== undefined
        ? slugify(dto.slug.trim() ? dto.slug : name)
        : dto.name !== undefined
          ? slugify(name)
          : current.slug;
    const parentId =
      dto.parentId === undefined
        ? current.parentId
        : await this.resolveParent(ownerId, dto.parentId, id);

    try {
      const [updated] = await this.db
        .update(categories)
        .set({
          name,
          slug,
          description: dto.description === undefined ? current.description : dto.description,
          parentId,
          sort: dto.sort ?? current.sort,
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning();
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Category slug already exists at this level');
      }
      throw error;
    }
  }

  async remove(ownerId: string, id: string) {
    await this.getOwned(ownerId, id);
    const [child] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          eq(categories.ownerId, ownerId),
          eq(categories.parentId, id),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);
    if (child) {
      throw new BadRequestException('Cannot delete a category that still has children');
    }

    const [deleted] = await this.db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return deleted;
  }

  private async resolveParent(
    ownerId: string,
    parentId: string | null,
    selfId?: string,
  ): Promise<string | null> {
    if (!parentId) {
      return null;
    }
    if (selfId && parentId === selfId) {
      throw new BadRequestException('Category cannot be its own parent');
    }
    const parent = await this.getOwned(ownerId, parentId);
    if (selfId && (await this.isAncestor(ownerId, parent.id, selfId))) {
      throw new BadRequestException('Category parent would create a cycle');
    }
    return parent.id;
  }

  private async isAncestor(ownerId: string, startId: string, targetId: string): Promise<boolean> {
    let currentId: string | null = startId;
    const seen = new Set<string>();
    while (currentId) {
      if (currentId === targetId) {
        return true;
      }
      if (seen.has(currentId)) {
        return true;
      }
      seen.add(currentId);
      const [row] = await this.db
        .select({ parentId: categories.parentId })
        .from(categories)
        .where(
          and(
            eq(categories.id, currentId),
            eq(categories.ownerId, ownerId),
            isNull(categories.deletedAt),
          ),
        )
        .limit(1);
      currentId = row?.parentId ?? null;
    }
    return false;
  }
}

function requireName(name: string | undefined): string {
  const value = name?.trim() ?? '';
  if (!value) {
    throw new BadRequestException('Name is required');
  }
  return value.slice(0, 100);
}
