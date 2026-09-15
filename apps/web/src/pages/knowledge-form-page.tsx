import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  createKnowledge,
  fetchCategoryTree,
  fetchKnowledge,
  flattenCategoryTree,
  listTags,
  updateKnowledge,
} from '@/apis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Select, Textarea } from '@/components/ui/form-controls';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useKnowledgePermissions } from '@/hooks/use-knowledge-permissions';
import { paths } from '@/routers/paths';

type Values = {
  title: string;
  summary: string;
  body: string;
  categoryId: string;
  published: boolean;
  tagIds: string[];
};

export function KnowledgeFormPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = useKnowledgePermissions();
  const canSubmit = isNew ? canCreate : canUpdate;

  const tree = useQuery({ queryKey: ['categories-tree'], queryFn: fetchCategoryTree });
  const tags = useQuery({
    queryKey: ['tags-all'],
    queryFn: () => listTags({ page: 1, pageSize: 100 }),
  });
  const existing = useQuery({
    queryKey: ['knowledge', id],
    queryFn: () => fetchKnowledge(id!),
    enabled: Boolean(id),
  });

  const form = useForm<Values>({
    defaultValues: {
      title: '',
      summary: '',
      body: '',
      categoryId: '',
      published: false,
      tagIds: [],
    },
    resolver: (values, context, options) =>
      zodResolver(
        z.object({
          title: z.string().min(1, t('validation.titleRequired')),
          summary: z.string(),
          body: z.string(),
          categoryId: z.string(),
          published: z.boolean(),
          tagIds: z.array(z.string()),
        }),
      )(values, context, options),
  });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      title: existing.data.title,
      summary: existing.data.summary ?? '',
      body: existing.data.body ?? '',
      categoryId: existing.data.categoryId ?? '',
      published: existing.data.published,
      tagIds: existing.data.tags.map((tag) => tag.id),
    });
  }, [existing.data, form]);

  const categories = flattenCategoryTree(tree.data ?? []);

  return (
    <WorkspaceShell title={isNew ? t('knowledge.create') : t('knowledge.edit')}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isNew ? t('knowledge.create') : t('knowledge.edit')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              if (!canSubmit) {
                return;
              }
              try {
                const payload = {
                  title: values.title,
                  summary: values.summary || null,
                  body: values.body || null,
                  categoryId: values.categoryId || null,
                  published: values.published,
                  tagIds: values.tagIds,
                };
                if (isNew) {
                  await createKnowledge(payload);
                } else {
                  await updateKnowledge(id, payload);
                }
                toast.success(t('common.saved'));
                void queryClient.invalidateQueries({ queryKey: ['knowledges'] });
                void navigate(paths.knowledges);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('common.saveFailed'));
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="title">{t('knowledge.titleField')}</Label>
              <Input id="title" {...form.register('title')} disabled={!canSubmit} />
              {form.formState.errors.title ? (
                <FieldError>{form.formState.errors.title.message}</FieldError>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="summary">{t('knowledge.summary')}</Label>
              <Textarea id="summary" {...form.register('summary')} disabled={!canSubmit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">{t('knowledge.body')}</Label>
              <Textarea id="body" {...form.register('body')} disabled={!canSubmit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryId">{t('knowledge.category')}</Label>
              <Select id="categoryId" {...form.register('categoryId')} disabled={!canSubmit}>
                <option value="">{t('common.none')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {'—'.repeat(category.depth)} {category.name}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('published')} disabled={!canSubmit} />
              {t('knowledge.publishedYes')}
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{t('nav.tags')}</legend>
              <div className="flex flex-wrap gap-3">
                {(tags.data?.records ?? []).map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      value={tag.id}
                      {...form.register('tagIds')}
                      disabled={!canSubmit}
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex gap-2">
              {canSubmit ? (
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {t('common.save')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigate(paths.knowledges)}
              >
                {t('common.back')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
