import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { createTag, deleteTag, listTags, updateTag } from '@/apis';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useKnowledgePermissions } from '@/hooks/use-knowledge-permissions';

type Values = { name: string };

export function TagsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = useKnowledgePermissions();
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ['tags', page],
    queryFn: () => listTags({ page, pageSize: 20 }),
  });

  const form = useForm<Values>({
    defaultValues: { name: '' },
    resolver: (values, context, options) =>
      zodResolver(z.object({ name: z.string().min(1, t('validation.nameRequired')) }))(
        values,
        context,
        options,
      ),
  });

  return (
    <WorkspaceShell title={t('tag.title')}>
      {canCreate || canUpdate ? (
        <Card className="mb-6 max-w-xl">
          <CardHeader>
            <CardTitle>{editingId ? t('tag.edit') : t('tag.create')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  if (editingId) {
                    await updateTag(editingId, values);
                  } else {
                    await createTag(values);
                  }
                  form.reset({ name: '' });
                  setEditingId(null);
                  toast.success(t('common.saved'));
                  void queryClient.invalidateQueries({ queryKey: ['tags'] });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t('common.saveFailed'));
                }
              })}
            >
              <Field>
                <FieldLabel htmlFor="name">{t('common.name')}</FieldLabel>
                <Input id="name" {...form.register('name')} />
                <FieldError>{form.formState.errors.name?.message}</FieldError>
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {t('common.save')}
                </Button>
                {editingId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      form.reset({ name: '' });
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-2">
        {(list.data?.records ?? []).map((tag) => (
          <div
            key={tag.id}
            className="flex items-center justify-between rounded-md border bg-card px-4 py-3"
          >
            <p className="font-medium">{tag.name}</p>
            <div className="flex gap-2">
              {canUpdate ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(tag.id);
                    form.reset({ name: tag.name });
                  }}
                >
                  {t('common.edit')}
                </Button>
              ) : null}
              {canDelete ? (
                <ConfirmDeleteButton
                  onConfirm={() => {
                    void deleteTag(tag.id)
                      .then(() => {
                        toast.success(t('common.deleted'));
                        void queryClient.invalidateQueries({ queryKey: ['tags'] });
                      })
                      .catch((error: unknown) => {
                        toast.error(
                          error instanceof Error ? error.message : t('common.deleteFailed'),
                        );
                      });
                  }}
                />
              ) : null}
            </div>
          </div>
        ))}
        {list.isSuccess && list.data.records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('tag.empty')}</p>
        ) : null}
      </div>

      {list.data && list.data.totalPages > 1 ? (
        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            {t('common.prev')}
          </Button>
          <span className="text-sm">
            {list.data.page} / {list.data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= list.data.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            {t('common.next')}
          </Button>
        </div>
      ) : null}
    </WorkspaceShell>
  );
}
