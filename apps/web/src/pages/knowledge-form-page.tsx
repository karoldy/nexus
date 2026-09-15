import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useKnowledgePermissions } from '@/hooks/use-knowledge-permissions';
import { paths } from '@/routers/paths';

const NONE_CATEGORY = 'none';

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
      categoryId: NONE_CATEGORY,
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
      categoryId: existing.data.categoryId ?? NONE_CATEGORY,
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
                  categoryId: values.categoryId === NONE_CATEGORY ? null : values.categoryId,
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
            <Field>
              <FieldLabel htmlFor="title">{t('knowledge.titleField')}</FieldLabel>
              <Input id="title" {...form.register('title')} disabled={!canSubmit} />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="summary">{t('knowledge.summary')}</FieldLabel>
              <Textarea id="summary" {...form.register('summary')} disabled={!canSubmit} />
            </Field>
            <Field>
              <FieldLabel htmlFor="body">{t('knowledge.body')}</FieldLabel>
              <Textarea id="body" {...form.register('body')} disabled={!canSubmit} />
            </Field>
            <Field>
              <FieldLabel htmlFor="categoryId">{t('knowledge.category')}</FieldLabel>
              <Controller
                control={form.control}
                name="categoryId"
                render={({ field }) => {
                  const options = [
                    { value: NONE_CATEGORY, label: t('common.none') },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: `${'—'.repeat(category.depth)} ${category.name}`,
                    })),
                  ];
                  return (
                    <Select
                      items={options}
                      value={field.value}
                      disabled={!canSubmit}
                      onValueChange={(value) => {
                        if (typeof value === 'string') {
                          field.onChange(value);
                        }
                      }}
                    >
                      <SelectTrigger id="categoryId" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                }}
              />
            </Field>
            <Controller
              control={form.control}
              name="published"
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Checkbox
                    id="published"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    disabled={!canSubmit}
                  />
                  <FieldLabel htmlFor="published">{t('knowledge.publishedYes')}</FieldLabel>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="tagIds"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>{t('nav.tags')}</FieldLegend>
                  <div className="flex flex-wrap gap-3">
                    {(tags.data?.records ?? []).map((tag) => {
                      const checked = field.value.includes(tag.id);
                      return (
                        <Field key={tag.id} orientation="horizontal" className="w-auto">
                          <Checkbox
                            id={`tag-${tag.id}`}
                            checked={checked}
                            disabled={!canSubmit}
                            onCheckedChange={(next) => {
                              field.onChange(
                                next === true
                                  ? [...field.value, tag.id]
                                  : field.value.filter((value) => value !== tag.id),
                              );
                            }}
                          />
                          <FieldLabel htmlFor={`tag-${tag.id}`}>{tag.name}</FieldLabel>
                        </Field>
                      );
                    })}
                  </div>
                </FieldSet>
              )}
            />
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
