export type Category = {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  sort: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CategoryTreeNode = Category & { children: CategoryTreeNode[] };

export type CategoryFlatNode = Category & { depth: number };

export type CategoryPayload = {
  name: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  sort?: number;
};
