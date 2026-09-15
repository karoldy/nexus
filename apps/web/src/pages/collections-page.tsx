import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { deleteCollection, listCollections } from '@/apis';
import { ConfirmDeleteButton } from '@/components/confirm-delete-button';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useQuestionPermissions } from '@/hooks/use-question-permissions';
import { paths } from '@/routers/paths';

export function CollectionsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = useQuestionPermissions();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [published, setPublished] = useState<'all' | 'true' | 'false'>('all');

  const list = useQuery({
    queryKey: ['collections', page, q, published],
    queryFn: () =>
      listCollections({
        page,
        pageSize: 10,
        q: q.trim() || undefined,
        published: published === 'all' ? undefined : published === 'true',
      }),
  });

  return (
    <WorkspaceShell title={t('collection.title')}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field className="w-56">
          <FieldLabel htmlFor="q">{t('collection.search')}</FieldLabel>
          <Input
            id="q"
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
          />
        </Field>
        <Field className="w-40">
          <FieldLabel htmlFor="published">{t('collection.published')}</FieldLabel>
          <Select
            value={published}
            items={[
              { value: 'all', label: t('collection.all') },
              { value: 'true', label: t('collection.publishedYes') },
              { value: 'false', label: t('collection.draft') },
            ]}
            onValueChange={(value) => {
              if (value !== 'all' && value !== 'true' && value !== 'false') {
                return;
              }
              setPage(1);
              setPublished(value);
            }}
          >
            <SelectTrigger id="published" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('collection.all')}</SelectItem>
              <SelectItem value="true">{t('collection.publishedYes')}</SelectItem>
              <SelectItem value="false">{t('collection.draft')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {canCreate ? (
          <Link className={buttonVariants()} to={paths.collectionNew}>
            {t('collection.create')}
          </Link>
        ) : null}
      </div>

      {list.isError ? (
        <p className="text-sm text-destructive">
          {list.error instanceof Error ? list.error.message : t('common.loadFailed')}
        </p>
      ) : null}

      <div className="space-y-3">
        {(list.data?.records ?? []).map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
              <div>
                <Link className="font-medium hover:underline" to={paths.collectionEdit(item.id)}>
                  {item.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {item.published ? t('collection.publishedYes') : t('collection.draft')}
                  {item.description ? ` · ${item.description}` : ''}
                </p>
              </div>
              {canDelete ? (
                <ConfirmDeleteButton
                  onConfirm={() => {
                    void deleteCollection(item.id)
                      .then(() => {
                        toast.success(t('common.deleted'));
                        void queryClient.invalidateQueries({ queryKey: ['collections'] });
                      })
                      .catch((error: unknown) => {
                        toast.error(
                          error instanceof Error ? error.message : t('common.deleteFailed'),
                        );
                      });
                  }}
                />
              ) : null}
            </CardContent>
          </Card>
        ))}
        {list.isSuccess && list.data.records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('collection.empty')}</p>
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
