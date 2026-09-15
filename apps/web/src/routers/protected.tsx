import { Route } from 'react-router';
import { ProtectedRoute } from '@/components/route-gates';
import { CategoriesPage } from '@/pages/categories-page';
import { HomePage } from '@/pages/home-page';
import { KnowledgeFormPage } from '@/pages/knowledge-form-page';
import { KnowledgesPage } from '@/pages/knowledges-page';
import { TagsPage } from '@/pages/tags-page';

export function protectedRoutes() {
  return (
    <Route element={<ProtectedRoute />}>
      <Route index element={<HomePage />} />
      <Route path="knowledges" element={<KnowledgesPage />} />
      <Route path="knowledges/new" element={<KnowledgeFormPage />} />
      <Route path="knowledges/:id" element={<KnowledgeFormPage />} />
      <Route path="categories" element={<CategoriesPage />} />
      <Route path="tags" element={<TagsPage />} />
    </Route>
  );
}
