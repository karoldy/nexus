import { deleteData, getData, patchData, postData, type Paginated } from './http';

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

export type CategoryPayload = {
  name: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  sort?: number;
};

export function listCategories(params?: { page?: number; pageSize?: number }) {
  return getData<Paginated<Category>>('/api/categories', params);
}

export function fetchCategoryTree() {
  return getData<CategoryTreeNode[]>('/api/categories/tree');
}

export function fetchCategory(id: string) {
  return getData<Category>(`/api/categories/${id}`);
}

export function createCategory(body: CategoryPayload) {
  return postData<Category>('/api/categories', body);
}

export function updateCategory(id: string, body: Partial<CategoryPayload>) {
  return patchData<Category>(`/api/categories/${id}`, body);
}

export function deleteCategory(id: string) {
  return deleteData<Category>(`/api/categories/${id}`);
}

export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  depth = 0,
): Array<Category & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ]);
}
