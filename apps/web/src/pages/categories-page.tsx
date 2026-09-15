import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  createCategory,
  deleteCategory,
  fetchCategoryTree,
  flattenCategoryTree,
  updateCategory,
} from '@/apis';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useKnowledgePermissions } from '@/hooks/use-knowledge-permissions';

const ROOT_PARENT = 'root';

type Values = {
  name: string;
  slug: string;
  parentId: string;
};

export function CategoriesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canCreate, canUpdate, canDelete } = useKnowledgePermissions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const tree = useQuery({ queryKey: ['categories-tree'], queryFn: fetchCategoryTree });
  const rows = flattenCategoryTree(tree.data ?? []);

  const form = useForm<Values>({
    defaultValues: { name: '', slug: '', parentId: ROOT_PARENT },
    resolver: (values, context, options) =>
      zodResolver(
        z.object({
          name: z.string().min(1, t('validation.nameRequired')),
          slug: z.string(),
          parentId: z.string(),
        }),
      )(values, context, options),
  });

  return (
    <WorkspaceShell title={t('category.title')}>
      {canCreate || canUpdate ? (
        <Card className="mb-6 max-w-xl">
          <CardHeader>
            <CardTitle>{editingId ? t('category.edit') : t('category.create')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  const payload = {
                    name: values.name,
                    slug: values.slug.trim() || undefined,
                    parentId: values.parentId === ROOT_PARENT ? null : values.parentId,
                  };
                  if (editingId) {
                    await updateCategory(editingId, payload);
                  } else {
                    await createCategory(payload);
                  }
                  form.reset({ name: '', slug: '', parentId: ROOT_PARENT });
                  setEditingId(null);
                  toast.success(t('common.saved'));
                  void queryClient.invalidateQueries({ queryKey: ['categories-tree'] });
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
              <Field>
                <FieldLabel htmlFor="slug">{t('category.slug')}</FieldLabel>
                <Input id="slug" {...form.register('slug')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="parentId">{t('category.parent')}</FieldLabel>
                <Controller
                  control={form.control}
                  name="parentId"
                  render={({ field }) => {
                    const options = [
                      { value: ROOT_PARENT, label: t('category.root') },
                      ...rows
                        .filter((row) => row.id !== editingId)
                        .map((row) => ({
                          value: row.id,
                          label: `${'—'.repeat(row.depth)} ${row.name}`,
                        })),
                    ];
                    return (
                      <Select
                        items={options}
                        value={field.value}
                        onValueChange={(value) => {
                          if (typeof value === 'string') {
                            field.onChange(value);
                          }
                        }}
                      >
                        <SelectTrigger id="parentId" className="w-full">
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
                      form.reset({ name: '', slug: '', parentId: ROOT_PARENT });
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
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between rounded-md border bg-card px-4 py-3"
            style={{ marginLeft: row.depth * 16 }}
          >
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-muted-foreground">{row.slug}</p>
            </div>
            <div className="flex gap-2">
              {canUpdate ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(row.id);
                    form.reset({
                      name: row.name,
                      slug: row.slug,
                      parentId: row.parentId ?? ROOT_PARENT,
                    });
                  }}
                >
                  {t('common.edit')}
                </Button>
              ) : null}
              {canDelete ? (
                <ConfirmDeleteButton
                  onConfirm={() => {
                    void deleteCategory(row.id)
                      .then(() => {
                        toast.success(t('common.deleted'));
                        void queryClient.invalidateQueries({ queryKey: ['categories-tree'] });
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
        {tree.isSuccess && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('category.empty')}</p>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}
