import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { createQuestion, fetchQuestion, listKnowledges, updateQuestion } from '@/apis';
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
import { useQuestionPermissions } from '@/hooks/use-question-permissions';
import { paths } from '@/routers/paths';
import {
  QUESTION_TYPES,
  type Question,
  type QuestionOption,
  type QuestionPayload,
  type QuestionType,
} from '@/types';

type Values = {
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  correctIndexes: number[];
  trueFalse: boolean;
  shortAnswer: string;
  blanks: string[];
  explanation: string;
  difficulty: number;
  published: boolean;
  knowledgeIds: string[];
};

function isChoice(type: QuestionType) {
  return type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE';
}

function defaultOptions(): QuestionOption[] {
  return [{ text: '' }, { text: '' }];
}

function defaultValues(): Values {
  return {
    type: 'SINGLE_CHOICE',
    stem: '',
    options: defaultOptions(),
    correctIndexes: [0],
    trueFalse: true,
    shortAnswer: '',
    blanks: [''],
    explanation: '',
    difficulty: 3,
    published: false,
    knowledgeIds: [],
  };
}

function valuesFromQuestion(question: Question): Values {
  const options = question.options?.length ? question.options : defaultOptions();
  const answer = question.answer ?? {};
  let correctIndexes = [0];
  if (question.type === 'SINGLE_CHOICE' && typeof answer.optionId === 'string') {
    const index = options.findIndex((option) => option.id === answer.optionId);
    correctIndexes = [index >= 0 ? index : 0];
  }
  if (question.type === 'MULTIPLE_CHOICE' && Array.isArray(answer.optionIds)) {
    correctIndexes = answer.optionIds
      .map((id) => options.findIndex((option) => option.id === id))
      .filter((index) => index >= 0);
  }
  return {
    type: question.type,
    stem: question.stem,
    options,
    correctIndexes,
    trueFalse: answer.value === false ? false : true,
    shortAnswer: typeof answer.text === 'string' ? answer.text : '',
    blanks: Array.isArray(answer.blanks)
      ? answer.blanks.filter((blank): blank is string => typeof blank === 'string')
      : [''],
    explanation: question.explanation ?? '',
    difficulty: question.difficulty,
    published: question.published,
    knowledgeIds: question.knowledges.map((knowledge) => knowledge.id),
  };
}

function buildPayload(values: Values): QuestionPayload {
  const knowledgeIds = values.published ? values.knowledgeIds : [];
  const base = {
    type: values.type,
    stem: values.stem,
    explanation: values.explanation || null,
    difficulty: values.difficulty,
    published: values.published,
    knowledgeIds,
  };

  if (values.type === 'SINGLE_CHOICE') {
    return {
      ...base,
      options: values.options,
      answer: { optionIndex: values.correctIndexes[0] ?? 0 },
    };
  }
  if (values.type === 'MULTIPLE_CHOICE') {
    return {
      ...base,
      options: values.options,
      answer: { optionIndexes: values.correctIndexes },
    };
  }
  if (values.type === 'TRUE_FALSE') {
    return { ...base, options: null, answer: { value: values.trueFalse } };
  }
  if (values.type === 'SHORT_ANSWER') {
    return { ...base, options: null, answer: { text: values.shortAnswer } };
  }
  return { ...base, options: null, answer: { blanks: values.blanks } };
}

export function QuestionFormPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = useQuestionPermissions();
  const canSubmit = isNew ? canCreate : canUpdate;

  const existing = useQuery({
    queryKey: ['question', id],
    queryFn: () => fetchQuestion(id!),
    enabled: Boolean(id),
  });
  const knowledges = useQuery({
    queryKey: ['knowledges-published'],
    queryFn: () => listKnowledges({ page: 1, pageSize: 100, published: true }),
  });

  const form = useForm<Values>({
    defaultValues: defaultValues(),
    resolver: (values, context, options) =>
      zodResolver(
        z
          .object({
            type: z.enum(QUESTION_TYPES),
            stem: z.string().min(1, t('validation.stemRequired')),
            options: z.array(z.object({ id: z.string().optional(), text: z.string() })),
            correctIndexes: z.array(z.number()),
            trueFalse: z.boolean(),
            shortAnswer: z.string(),
            blanks: z.array(z.string()),
            explanation: z.string(),
            difficulty: z.number().int().min(1).max(5),
            published: z.boolean(),
            knowledgeIds: z.array(z.string()),
          })
          .superRefine((value, ctx) => {
            if (isChoice(value.type)) {
              if (value.options.length < 2) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['options'],
                  message: t('validation.optionMin'),
                });
              }
              if (value.options.some((option) => !option.text.trim())) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['options'],
                  message: t('validation.optionText'),
                });
              }
              if (value.type === 'SINGLE_CHOICE' && value.correctIndexes.length !== 1) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['correctIndexes'],
                  message: t('validation.answerRequired'),
                });
              }
              if (value.type === 'MULTIPLE_CHOICE' && value.correctIndexes.length < 1) {
                ctx.addIssue({
                  code: 'custom',
                  path: ['correctIndexes'],
                  message: t('validation.answerRequired'),
                });
              }
            }
            if (value.type === 'SHORT_ANSWER' && !value.shortAnswer.trim()) {
              ctx.addIssue({
                code: 'custom',
                path: ['shortAnswer'],
                message: t('validation.answerRequired'),
              });
            }
            if (
              value.type === 'FILL_BLANK' &&
              (value.blanks.length < 1 || value.blanks.some((blank) => !blank.trim()))
            ) {
              ctx.addIssue({
                code: 'custom',
                path: ['blanks'],
                message: t('validation.blankRequired'),
              });
            }
          }),
      )(values, context, options),
  });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset(valuesFromQuestion(existing.data));
  }, [existing.data, form]);

  const type = useWatch({ control: form.control, name: 'type' });
  const published = useWatch({ control: form.control, name: 'published' });
  const options = useWatch({ control: form.control, name: 'options' });
  const correctIndexes = useWatch({ control: form.control, name: 'correctIndexes' });
  const blanks = useWatch({ control: form.control, name: 'blanks' });

  return (
    <WorkspaceShell title={isNew ? t('question.create') : t('question.edit')}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isNew ? t('question.create') : t('question.edit')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              if (!canSubmit) {
                return;
              }
              try {
                const payload = buildPayload(values);
                if (isNew) {
                  await createQuestion(payload);
                } else {
                  await updateQuestion(id, payload);
                }
                toast.success(t('common.saved'));
                void queryClient.invalidateQueries({ queryKey: ['questions'] });
                void navigate(paths.questions);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('common.saveFailed'));
              }
            })}
          >
            <Field>
              <FieldLabel htmlFor="type">{t('question.type')}</FieldLabel>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    items={QUESTION_TYPES.map((value) => ({
                      value,
                      label: t(`question.types.${value}`),
                    }))}
                    value={field.value}
                    disabled={!canSubmit}
                    onValueChange={(value) => {
                      if (!QUESTION_TYPES.includes(value as QuestionType)) {
                        return;
                      }
                      const next = value as QuestionType;
                      field.onChange(next);
                      form.setValue('options', defaultOptions());
                      form.setValue('correctIndexes', next === 'MULTIPLE_CHOICE' ? [] : [0]);
                      form.setValue('trueFalse', true);
                      form.setValue('shortAnswer', '');
                      form.setValue('blanks', ['']);
                    }}
                  >
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`question.types.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="stem">{t('question.stem')}</FieldLabel>
              <Textarea id="stem" {...form.register('stem')} disabled={!canSubmit} />
              <FieldError>{form.formState.errors.stem?.message}</FieldError>
            </Field>

            {isChoice(type) ? (
              <FieldSet>
                <FieldLegend>{t('question.options')}</FieldLegend>
                <div className="space-y-3">
                  {options.map((option, index) => (
                    <Field key={option.id ?? index} orientation="horizontal">
                      {type === 'SINGLE_CHOICE' ? (
                        <input
                          type="radio"
                          name="correct-option"
                          className="size-4 accent-primary"
                          checked={correctIndexes[0] === index}
                          disabled={!canSubmit}
                          onChange={() => form.setValue('correctIndexes', [index])}
                        />
                      ) : (
                        <Checkbox
                          checked={correctIndexes.includes(index)}
                          disabled={!canSubmit}
                          onCheckedChange={(checked) => {
                            form.setValue(
                              'correctIndexes',
                              checked === true
                                ? [...correctIndexes, index]
                                : correctIndexes.filter((value) => value !== index),
                            );
                          }}
                        />
                      )}
                      <Input
                        value={option.text}
                        disabled={!canSubmit}
                        onChange={(event) => {
                          const next = [...options];
                          next[index] = { ...option, text: event.target.value };
                          form.setValue('options', next);
                        }}
                      />
                      {options.length > 2 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canSubmit}
                          onClick={() => {
                            form.setValue(
                              'options',
                              options.filter((_, optionIndex) => optionIndex !== index),
                            );
                            form.setValue(
                              'correctIndexes',
                              correctIndexes
                                .filter((value) => value !== index)
                                .map((value) => (value > index ? value - 1 : value)),
                            );
                          }}
                        >
                          {t('question.removeOption')}
                        </Button>
                      ) : null}
                    </Field>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canSubmit}
                    onClick={() => form.setValue('options', [...options, { text: '' }])}
                  >
                    {t('question.addOption')}
                  </Button>
                  <FieldError>
                    {form.formState.errors.options?.message ??
                      form.formState.errors.correctIndexes?.message}
                  </FieldError>
                </div>
              </FieldSet>
            ) : null}

            {type === 'TRUE_FALSE' ? (
              <Controller
                control={form.control}
                name="trueFalse"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="trueFalse">{t('question.answer')}</FieldLabel>
                    <Select
                      items={[
                        { value: 'true', label: t('question.true') },
                        { value: 'false', label: t('question.false') },
                      ]}
                      value={field.value ? 'true' : 'false'}
                      disabled={!canSubmit}
                      onValueChange={(value) => field.onChange(value === 'true')}
                    >
                      <SelectTrigger id="trueFalse" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">{t('question.true')}</SelectItem>
                        <SelectItem value="false">{t('question.false')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            ) : null}

            {type === 'SHORT_ANSWER' ? (
              <Field>
                <FieldLabel htmlFor="shortAnswer">{t('question.answer')}</FieldLabel>
                <Input id="shortAnswer" {...form.register('shortAnswer')} disabled={!canSubmit} />
                <FieldError>{form.formState.errors.shortAnswer?.message}</FieldError>
              </Field>
            ) : null}

            {type === 'FILL_BLANK' ? (
              <FieldSet>
                <FieldLegend>{t('question.blanks')}</FieldLegend>
                <div className="space-y-3">
                  {blanks.map((blank, index) => (
                    <Field key={index} orientation="horizontal">
                      <Input
                        value={blank}
                        disabled={!canSubmit}
                        onChange={(event) => {
                          const next = [...blanks];
                          next[index] = event.target.value;
                          form.setValue('blanks', next);
                        }}
                      />
                      {blanks.length > 1 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!canSubmit}
                          onClick={() =>
                            form.setValue(
                              'blanks',
                              blanks.filter((_, blankIndex) => blankIndex !== index),
                            )
                          }
                        >
                          {t('question.removeBlank')}
                        </Button>
                      ) : null}
                    </Field>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!canSubmit}
                    onClick={() => form.setValue('blanks', [...blanks, ''])}
                  >
                    {t('question.addBlank')}
                  </Button>
                  <FieldError>{form.formState.errors.blanks?.message}</FieldError>
                </div>
              </FieldSet>
            ) : null}

            <Field>
              <FieldLabel htmlFor="explanation">{t('question.explanation')}</FieldLabel>
              <Textarea id="explanation" {...form.register('explanation')} disabled={!canSubmit} />
            </Field>
            <Field>
              <FieldLabel htmlFor="difficulty">{t('question.difficulty')}</FieldLabel>
              <Controller
                control={form.control}
                name="difficulty"
                render={({ field }) => {
                  const items = [1, 2, 3, 4, 5].map((value) => ({
                    value: String(value),
                    label: t('question.difficultyValue', { value }),
                  }));
                  return (
                    <Select
                      items={items}
                      value={String(field.value)}
                      disabled={!canSubmit}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <SelectTrigger id="difficulty" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
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
                    onCheckedChange={(checked) => {
                      const next = checked === true;
                      field.onChange(next);
                      if (!next) {
                        form.setValue('knowledgeIds', []);
                      }
                    }}
                    disabled={!canSubmit}
                  />
                  <FieldLabel htmlFor="published">{t('question.publishedYes')}</FieldLabel>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="knowledgeIds"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>{t('question.knowledges')}</FieldLegend>
                  <p className="text-sm text-muted-foreground">{t('question.knowledgesHint')}</p>
                  <div className="flex flex-wrap gap-3">
                    {(knowledges.data?.records ?? []).map((knowledge) => {
                      const checked = field.value.includes(knowledge.id);
                      return (
                        <Field key={knowledge.id} orientation="horizontal" className="w-auto">
                          <Checkbox
                            id={`knowledge-${knowledge.id}`}
                            checked={checked}
                            disabled={!canSubmit || !published}
                            onCheckedChange={(next) => {
                              field.onChange(
                                next === true
                                  ? [...field.value, knowledge.id]
                                  : field.value.filter((value) => value !== knowledge.id),
                              );
                            }}
                          />
                          <FieldLabel htmlFor={`knowledge-${knowledge.id}`}>
                            {knowledge.title}
                          </FieldLabel>
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
                onClick={() => void navigate(paths.questions)}
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
