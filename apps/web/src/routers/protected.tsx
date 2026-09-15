import { Route } from 'react-router';
import { ProtectedRoute } from '@/components/route-gates';
import { CategoriesPage } from '@/pages/categories-page';
import { CollectionFormPage } from '@/pages/collection-form-page';
import { CollectionsPage } from '@/pages/collections-page';
import { HomePage } from '@/pages/home-page';
import { KnowledgeFormPage } from '@/pages/knowledge-form-page';
import { KnowledgesPage } from '@/pages/knowledges-page';
import { QuestionFormPage } from '@/pages/question-form-page';
import { QuestionsPage } from '@/pages/questions-page';
import { TagsPage } from '@/pages/tags-page';

export function protectedRoutes() {
  return (
    <Route element={<ProtectedRoute />}>
      <Route index element={<HomePage />} />
      <Route path="knowledges" element={<KnowledgesPage />} />
      <Route path="knowledges/new" element={<KnowledgeFormPage />} />
      <Route path="knowledges/:id" element={<KnowledgeFormPage />} />
      <Route path="questions" element={<QuestionsPage />} />
      <Route path="questions/new" element={<QuestionFormPage />} />
      <Route path="questions/:id" element={<QuestionFormPage />} />
      <Route path="collections" element={<CollectionsPage />} />
      <Route path="collections/new" element={<CollectionFormPage />} />
      <Route path="collections/:id" element={<CollectionFormPage />} />
      <Route path="categories" element={<CategoriesPage />} />
      <Route path="tags" element={<TagsPage />} />
    </Route>
  );
}
