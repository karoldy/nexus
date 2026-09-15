import type {
  Category,
  CategoryFlatNode,
  CategoryPayload,
  CategoryTreeNode,
  PageQuery,
  Paginated,
} from '@/types';
import { deleteData, getData, patchData, postData } from './http';

export function listCategories(params?: PageQuery) {
  return getData<Paginated<Category>>('/categories', params);
}

export function fetchCategoryTree() {
  return getData<CategoryTreeNode[]>('/categories/tree');
}

export function fetchCategory(id: string) {
  return getData<Category>(`/categories/${id}`);
}

export function createCategory(body: CategoryPayload) {
  return postData<Category>('/categories', body);
}

export function updateCategory(id: string, body: Partial<CategoryPayload>) {
  return patchData<Category>(`/categories/${id}`, body);
}

export function deleteCategory(id: string) {
  return deleteData<Category>(`/categories/${id}`);
}

export function flattenCategoryTree(nodes: CategoryTreeNode[], depth = 0): CategoryFlatNode[] {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ]);
}
