import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { createExam, fetchExam, listQuestions, updateExam } from '@/apis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useExamPermissions } from '@/hooks/use-exam-permissions';
import { paths } from '@/routers/paths';

type Values = {
  title: string;
  description: string;
  durationSeconds: string;
  published: boolean;
  questionIds: string[];
  scores: Record<string, string>;
};

export function ExamFormPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = useExamPermissions();
  const canSubmit = isNew ? canCreate : canUpdate;

  const existing = useQuery({
    queryKey: ['exam', id],
    queryFn: () => fetchExam(id!),
    enabled: Boolean(id),
  });
  const publishedQuestions = useQuery({
    queryKey: ['questions-published'],
    queryFn: () => listQuestions({ page: 1, pageSize: 100, published: true }),
  });

  const form = useForm<Values>({
    defaultValues: {
      title: '',
      description: '',
      durationSeconds: '',
      published: false,
      questionIds: [],
      scores: {},
    },
    resolver: (values, context, options) =>
      zodResolver(
        z.object({
          title: z.string().min(1, t('validation.titleRequired')),
          description: z.string(),
          durationSeconds: z.string(),
          published: z.boolean(),
          questionIds: z.array(z.string()),
          scores: z.record(z.string(), z.string()),
        }),
      )(values, context, options),
  });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    const scores: Record<string, string> = {};
    for (const question of existing.data.questions ?? []) {
      scores[question.id] = String(question.score);
    }
    form.reset({
      title: existing.data.title,
      description: existing.data.description ?? '',
      durationSeconds:
        existing.data.durationSeconds == null ? '' : String(existing.data.durationSeconds),
      published: existing.data.published,
      questionIds: (existing.data.questions ?? []).map((question) => question.id),
      scores,
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
    <WorkspaceShell title={isNew ? t('exam.create') : t('exam.edit')}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isNew ? t('exam.create') : t('exam.edit')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              if (!canSubmit) {
                return;
              }
              const duration = values.durationSeconds.trim();
              try {
                const payload = {
                  title: values.title,
                  description: values.description || null,
                  durationSeconds: duration === '' ? null : Number(duration),
                  published: values.published,
                  questions: values.questionIds.map((questionId) => ({
                    questionId,
                    score: Number(values.scores[questionId] || '1') || 1,
                  })),
                };
                if (isNew) {
                  await createExam(payload);
                } else {
                  await updateExam(id, payload);
                }
                toast.success(t('common.saved'));
                void queryClient.invalidateQueries({ queryKey: ['exams'] });
                void navigate(paths.exams);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('common.saveFailed'));
              }
            })}
          >
            <Field>
              <FieldLabel htmlFor="title">{t('exam.titleField')}</FieldLabel>
              <Input id="title" {...form.register('title')} disabled={!canSubmit} />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="description">{t('exam.description')}</FieldLabel>
              <Textarea id="description" {...form.register('description')} disabled={!canSubmit} />
            </Field>
            <Field>
              <FieldLabel htmlFor="durationSeconds">{t('exam.duration')}</FieldLabel>
              <Input
                id="durationSeconds"
                type="number"
                min={1}
                {...form.register('durationSeconds')}
                disabled={!canSubmit}
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
                  <FieldLabel htmlFor="published">{t('exam.publishedYes')}</FieldLabel>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="questionIds"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>{t('exam.questions')}</FieldLegend>
                  <p className="text-sm text-muted-foreground">{t('exam.questionsHint')}</p>
                  <div className="flex flex-col gap-3">
                    {picker.map((question) => {
                      const checked = field.value.includes(question.id);
                      return (
                        <div key={question.id} className="flex flex-wrap items-center gap-3">
                          <Field orientation="horizontal" className="w-auto">
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
                              {!question.published ? ` (${t('exam.draft')})` : ''}
                            </FieldLabel>
                          </Field>
                          {checked ? (
                            <Input
                              className="w-24"
                              type="number"
                              min={0}
                              step="0.01"
                              disabled={!canSubmit}
                              value={form.watch('scores')[question.id] ?? '1'}
                              onChange={(event) => {
                                form.setValue('scores', {
                                  ...form.getValues('scores'),
                                  [question.id]: event.target.value,
                                });
                              }}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                    {picker.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('exam.noQuestions')}</p>
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
              <Button type="button" variant="outline" onClick={() => void navigate(paths.exams)}>
                {t('common.back')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
