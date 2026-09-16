import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { createContent, fetchContent, listKnowledges, updateContent } from '@/apis';
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
import { useContentPermissions } from '@/hooks/use-content-permissions';
import { paths } from '@/routers/paths';
import { CONTENT_TYPES, type ContentPayload, type ContentType } from '@/types';

type Values = {
  type: ContentType;
  title: string;
  body: string;
  summary: string;
  url: string;
  fileKey: string;
  mimeType: string;
  fileSize: string;
  published: boolean;
  knowledgeIds: string[];
};

function defaultValues(): Values {
  return {
    type: 'NOTE',
    title: '',
    body: '',
    summary: '',
    url: '',
    fileKey: '',
    mimeType: '',
    fileSize: '',
    published: false,
    knowledgeIds: [],
  };
}

function buildPayload(values: Values): ContentPayload {
  const knowledgeIds = values.published ? values.knowledgeIds : [];
  const base = {
    type: values.type,
    title: values.title,
    summary: values.summary || null,
    published: values.published,
    knowledgeIds,
  };
  if (values.type === 'NOTE' || values.type === 'ARTICLE') {
    return { ...base, body: values.body, url: null, fileKey: null };
  }
  if (values.type === 'DOCUMENT') {
    const fileSize = values.fileSize.trim() === '' ? null : Number(values.fileSize);
    return {
      ...base,
      body: null,
      url: null,
      fileKey: values.fileKey,
      mimeType: values.mimeType || null,
      fileSize: Number.isInteger(fileSize) ? fileSize : null,
    };
  }
  return { ...base, body: null, fileKey: null, url: values.url };
}

export function ContentFormPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate } = useContentPermissions();
  const canSubmit = isNew ? canCreate : canUpdate;

  const existing = useQuery({
    queryKey: ['content', id],
    queryFn: () => fetchContent(id!),
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
            type: z.enum(CONTENT_TYPES),
            title: z.string().min(1, t('validation.titleRequired')),
            body: z.string(),
            summary: z.string(),
            url: z.string(),
            fileKey: z.string(),
            mimeType: z.string(),
            fileSize: z.string(),
            published: z.boolean(),
            knowledgeIds: z.array(z.string()),
          })
          .superRefine((value, ctx) => {
            if ((value.type === 'NOTE' || value.type === 'ARTICLE') && !value.body.trim()) {
              ctx.addIssue({
                code: 'custom',
                path: ['body'],
                message: t('validation.bodyRequired'),
              });
            }
            if (value.type === 'DOCUMENT' && !value.fileKey.trim()) {
              ctx.addIssue({
                code: 'custom',
                path: ['fileKey'],
                message: t('validation.fileKeyRequired'),
              });
            }
            if (value.type === 'RESOURCE' && !value.url.trim()) {
              ctx.addIssue({
                code: 'custom',
                path: ['url'],
                message: t('validation.urlRequired'),
              });
            }
          }),
      )(values, context, options),
  });

  useEffect(() => {
    if (!existing.data) {
      return;
    }
    form.reset({
      type: existing.data.type,
      title: existing.data.title,
      body: existing.data.body ?? '',
      summary: existing.data.summary ?? '',
      url: existing.data.url ?? '',
      fileKey: existing.data.fileKey ?? '',
      mimeType: existing.data.mimeType ?? '',
      fileSize: existing.data.fileSize == null ? '' : String(existing.data.fileSize),
      published: existing.data.published,
      knowledgeIds: existing.data.knowledges.map((knowledge) => knowledge.id),
    });
  }, [existing.data, form]);

  const type = useWatch({ control: form.control, name: 'type' });
  const published = useWatch({ control: form.control, name: 'published' });

  return (
    <WorkspaceShell title={isNew ? t('content.create') : t('content.edit')}>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{isNew ? t('content.create') : t('content.edit')}</CardTitle>
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
                  await createContent(payload);
                } else {
                  await updateContent(id, payload);
                }
                toast.success(t('common.saved'));
                void queryClient.invalidateQueries({ queryKey: ['contents'] });
                void navigate(paths.contents);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('common.saveFailed'));
              }
            })}
          >
            <Field>
              <FieldLabel htmlFor="type">{t('content.type')}</FieldLabel>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select
                    items={CONTENT_TYPES.map((value) => ({
                      value,
                      label: t(`content.types.${value}`),
                    }))}
                    value={field.value}
                    disabled={!canSubmit}
                    onValueChange={(value) => {
                      if (!CONTENT_TYPES.includes(value as ContentType)) {
                        return;
                      }
                      field.onChange(value);
                    }}
                  >
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`content.types.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="title">{t('content.titleField')}</FieldLabel>
              <Input id="title" {...form.register('title')} disabled={!canSubmit} />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>
            {type === 'NOTE' || type === 'ARTICLE' ? (
              <Field>
                <FieldLabel htmlFor="body">{t('content.body')}</FieldLabel>
                <Textarea id="body" {...form.register('body')} disabled={!canSubmit} />
                <FieldError>{form.formState.errors.body?.message}</FieldError>
              </Field>
            ) : null}
            {type === 'ARTICLE' ? (
              <Field>
                <FieldLabel htmlFor="summary">{t('content.summary')}</FieldLabel>
                <Textarea id="summary" {...form.register('summary')} disabled={!canSubmit} />
              </Field>
            ) : null}
            {type === 'DOCUMENT' ? (
              <>
                <Field>
                  <FieldLabel htmlFor="fileKey">{t('content.fileKey')}</FieldLabel>
                  <Input id="fileKey" {...form.register('fileKey')} disabled={!canSubmit} />
                  <FieldError>{form.formState.errors.fileKey?.message}</FieldError>
                </Field>
                <Field>
                  <FieldLabel htmlFor="mimeType">{t('content.mimeType')}</FieldLabel>
                  <Input id="mimeType" {...form.register('mimeType')} disabled={!canSubmit} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="fileSize">{t('content.fileSize')}</FieldLabel>
                  <Input
                    id="fileSize"
                    inputMode="numeric"
                    {...form.register('fileSize')}
                    disabled={!canSubmit}
                  />
                </Field>
              </>
            ) : null}
            {type === 'RESOURCE' ? (
              <Field>
                <FieldLabel htmlFor="url">{t('content.url')}</FieldLabel>
                <Input id="url" {...form.register('url')} disabled={!canSubmit} />
                <FieldError>{form.formState.errors.url?.message}</FieldError>
              </Field>
            ) : null}
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
                  <FieldLabel htmlFor="published">{t('content.publishedYes')}</FieldLabel>
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="knowledgeIds"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend>{t('content.knowledges')}</FieldLegend>
                  <p className="text-sm text-muted-foreground">{t('content.knowledgesHint')}</p>
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
              <Button type="button" variant="outline" onClick={() => void navigate(paths.contents)}>
                {t('common.back')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
