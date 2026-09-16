import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { fetchExamRecord, saveExamAnswers, submitExamRecord } from '@/apis';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useExamPermissions } from '@/hooks/use-exam-permissions';
import { paths } from '@/routers/paths';
import type { ExamAnswer, ExamRecord, QuestionType } from '@/types';

type Draft = Record<string, Record<string, unknown>>;

function draftFromRecord(record: ExamRecord): Draft {
  const next: Draft = {};
  for (const answer of record.answers ?? []) {
    next[answer.questionId] = answer.submittedAnswer ?? emptyDraft(answer);
  }
  return next;
}

function emptyDraft(answer: ExamAnswer): Record<string, unknown> {
  if (answer.type === 'MULTIPLE_CHOICE') {
    return { optionIds: [] };
  }
  if (answer.type === 'FILL_BLANK') {
    return { blanks: Array.from({ length: answer.blankCount ?? 1 }, () => '') };
  }
  if (answer.type === 'TRUE_FALSE') {
    return { value: true };
  }
  if (answer.type === 'SHORT_ANSWER') {
    return { text: '' };
  }
  return { optionId: '' };
}

export function ExamTakePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canUpdate } = useExamPermissions();
  const [draft, setDraft] = useState<Draft>({});

  const record = useQuery({
    queryKey: ['exam-record', id],
    queryFn: () => fetchExamRecord(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (record.data) {
      setDraft(draftFromRecord(record.data));
    }
  }, [record.data]);

  const save = useMutation({
    mutationFn: () =>
      saveExamAnswers(
        id!,
        Object.entries(draft).map(([questionId, submittedAnswer]) => ({
          questionId,
          submittedAnswer,
        })),
      ),
    onSuccess: (data) => {
      void queryClient.setQueryData(['exam-record', id], data);
      toast.success(t('common.saved'));
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t('common.saveFailed'));
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      await saveExamAnswers(
        id!,
        Object.entries(draft).map(([questionId, submittedAnswer]) => ({
          questionId,
          submittedAnswer,
        })),
      );
      return submitExamRecord(id!);
    },
    onSuccess: (data) => {
      void queryClient.setQueryData(['exam-record', id], data);
      toast.success(t('exam.submitted'));
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : t('exam.submitFailed'));
    },
  });

  const inProgress = record.data?.progress === 'IN_PROGRESS';

  return (
    <WorkspaceShell title={record.data?.examTitle ?? t('exam.take')}>
      {record.isError ? (
        <p className="text-sm text-destructive">
          {record.error instanceof Error ? record.error.message : t('common.loadFailed')}
        </p>
      ) : null}

      {record.data ? (
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {t(`exam.progress.${record.data.progress}`)}
            {record.data.progress !== 'IN_PROGRESS'
              ? ` · ${record.data.earnedScore ?? 0} / ${record.data.totalScore ?? 0}`
              : ''}
          </p>
          {(record.data.answers ?? []).map((answer, index) => (
            <Card key={answer.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {index + 1}. {answer.stem}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({t(`question.types.${answer.type as QuestionType}`)} · {answer.maxScore})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <AnswerFields
                  answer={answer}
                  disabled={!inProgress || !canUpdate}
                  value={draft[answer.questionId] ?? emptyDraft(answer)}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, [answer.questionId]: value }))
                  }
                />
                {answer.isCorrect != null ? (
                  <p className="text-sm">
                    {answer.isCorrect ? t('exam.correct') : t('exam.incorrect')}
                    {answer.score != null ? ` · ${answer.score}` : ''}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
          <div className="flex gap-2">
            {inProgress && canUpdate ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => save.mutate()}
                  disabled={save.isPending}
                >
                  {t('common.save')}
                </Button>
                <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending}>
                  {t('exam.submit')}
                </Button>
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={() => void navigate(paths.exams)}>
              {t('common.back')}
            </Button>
          </div>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}

function AnswerFields({
  answer,
  value,
  onChange,
  disabled,
}: {
  answer: ExamAnswer;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  if (answer.type === 'SINGLE_CHOICE') {
    return (
      <div className="flex flex-col gap-2">
        {(answer.options ?? []).map((option) => (
          <Field key={option.id} orientation="horizontal" className="w-auto">
            <Checkbox
              id={`${answer.id}-${option.id}`}
              checked={value.optionId === option.id}
              disabled={disabled}
              onCheckedChange={(checked) => {
                if (checked === true) {
                  onChange({ optionId: option.id });
                }
              }}
            />
            <FieldLabel htmlFor={`${answer.id}-${option.id}`}>{option.text}</FieldLabel>
          </Field>
        ))}
      </div>
    );
  }

  if (answer.type === 'MULTIPLE_CHOICE') {
    const selected = Array.isArray(value.optionIds) ? (value.optionIds as string[]) : [];
    return (
      <div className="flex flex-col gap-2">
        {(answer.options ?? []).map((option) => {
          const checked = selected.includes(option.id);
          return (
            <Field key={option.id} orientation="horizontal" className="w-auto">
              <Checkbox
                id={`${answer.id}-${option.id}`}
                checked={checked}
                disabled={disabled}
                onCheckedChange={(next) => {
                  onChange({
                    optionIds:
                      next === true
                        ? [...selected, option.id]
                        : selected.filter((id) => id !== option.id),
                  });
                }}
              />
              <FieldLabel htmlFor={`${answer.id}-${option.id}`}>{option.text}</FieldLabel>
            </Field>
          );
        })}
      </div>
    );
  }

  if (answer.type === 'TRUE_FALSE') {
    return (
      <div className="flex gap-4">
        <Field orientation="horizontal" className="w-auto">
          <Checkbox
            id={`${answer.id}-true`}
            checked={value.value === true}
            disabled={disabled}
            onCheckedChange={(checked) => {
              if (checked === true) {
                onChange({ value: true });
              }
            }}
          />
          <FieldLabel htmlFor={`${answer.id}-true`}>{t('question.true')}</FieldLabel>
        </Field>
        <Field orientation="horizontal" className="w-auto">
          <Checkbox
            id={`${answer.id}-false`}
            checked={value.value === false}
            disabled={disabled}
            onCheckedChange={(checked) => {
              if (checked === true) {
                onChange({ value: false });
              }
            }}
          />
          <FieldLabel htmlFor={`${answer.id}-false`}>{t('question.false')}</FieldLabel>
        </Field>
      </div>
    );
  }

  if (answer.type === 'FILL_BLANK') {
    const blanks = Array.isArray(value.blanks) ? (value.blanks as string[]) : [''];
    return (
      <div className="flex flex-col gap-2">
        {blanks.map((blank, index) => (
          <Input
            key={`${answer.id}-${index}`}
            value={blank}
            disabled={disabled}
            onChange={(event) => {
              const next = [...blanks];
              next[index] = event.target.value;
              onChange({ blanks: next });
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <Textarea
      value={typeof value.text === 'string' ? value.text : ''}
      disabled={disabled}
      onChange={(event) => onChange({ text: event.target.value })}
    />
  );
}
