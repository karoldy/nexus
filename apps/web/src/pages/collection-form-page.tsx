import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { createCollection, fetchCollection, listQuestions, updateCollection } from '@/apis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useQuestionPermissions } from '@/hooks/use-question-permissions';
import { paths } from '@/routers/paths';

type Values = {
  name: string;
  description: string;
  published: boolean;
  questionIds: string[];
};

export function CollectionFormPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = useQuestionPermissions();
  const canSubmit = isNew ? canCreate : canUpdate;

  const existing = useQuery({
    queryKey: ['collection', id],
    queryFn: () => fetchCollection(id!),
    enabled: Boolean(id),
  });
  const publishedQuestions = useQuery({
    queryKey: ['questions-published'],
    queryFn: () => listQuestions({ page: 1, pageSize: 100, published: true }),
  });

  const form = useForm<Values>({
    defaultValues: { name: '', description: '', published: false, questionIds: [] },
    resolver: (values, context, options) =>
      zodResolver(
        z.object({
          name: z.string().min(1, t('validation.nameRequired')),
          description: z.string(),
          published: z.boolean(),
          questionIds: z.array(z.string()),
        }),
      )(values, context, options),
  });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      name: existing.data.name,
      description: existing.data.description ?? '',
      published: existing.data.published,
      questionIds: (existing.data.questions ?? []).map((question) => question.id),
    });
  }, [existing.data, form]);

  const picker = useMemo(() => {
    const byId = new Map<string, { id: string; stem: string; published: boolean }>();
    for (const question of publishedQuestions.data?.records ?? []) {
      byId.set(question.id, {
        id: question.id,
        stem: question.stem,
        published: question.published,
      });
    }
    for (const question of existing.data?.questions ?? []) {
      if (!byId.has(question.id)) {
        byId.set(question.id, {
          id: question.id,
          stem: question.stem,
          published: question.published,
        });
      }
    }
    return [...byId.values()];
  }, [existing.data, publishedQuestions.data]);

  return (
    <WorkspaceShell title={isNew ? t('collection.create') : t('collection.edit')}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isNew ? t('collection.create') : t('collection.edit')}</CardTitle>
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
                  name: values.name,
                  description: values.description || null,
                  published: values.published,
                  questionIds: values.questionIds,
                };
                if (isNew) {
                  await createCollection(payload);
                } else {
                  await updateCollection(id, payload);
                }
                toast.success(t('common.saved'));
                void queryClient.invalidateQueries({ queryKey: ['collections'] });
                void navigate(paths.collections);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('common.saveFailed'));
              }
            })}
          >
            <Field>
              <FieldLabel htmlFor="name">{t('common.name')}</FieldLabel>
              <Input id="name" {...form.register('name')} disabled={!canSubmit} />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">{t('collection.description')}</FieldLabel>
              <Textarea id="description" {...form.register('description')} disabled={!canSubmit} />
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
                  <FieldLabel htmlFor="published">{t('collection.publishedYes')}</FieldLabel>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="questionIds"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>{t('collection.questions')}</FieldLegend>
                  <p className="text-sm text-muted-foreground">{t('collection.questionsHint')}</p>
                  <div className="flex flex-col gap-3">
                    {picker.map((question) => {
                      const checked = field.value.includes(question.id);
                      return (
                        <Field key={question.id} orientation="horizontal" className="w-auto">
                          <Checkbox
                            id={`question-${question.id}`}
                            checked={checked}
                            disabled={!canSubmit || (!question.published && !checked)}
                            onCheckedChange={(next) => {
                              field.onChange(
                                next === true
                                  ? [...field.value, question.id]
                                  : field.value.filter((value) => value !== question.id),
                              );
                            }}
                          />
                          <FieldLabel htmlFor={`question-${question.id}`}>
                            {question.stem}
                            {!question.published ? ` (${t('collection.draft')})` : ''}
                          </FieldLabel>
                        </Field>
                      );
                    })}
                    {picker.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('collection.noQuestions')}</p>
                    ) : null}
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
                onClick={() => void navigate(paths.collections)}
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
