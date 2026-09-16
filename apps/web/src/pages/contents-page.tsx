import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { deleteContent, listContents } from '@/apis';
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
import { useContentPermissions } from '@/hooks/use-content-permissions';
import { paths } from '@/routers/paths';
import { CONTENT_TYPES, type ContentType } from '@/types';

export function ContentsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = useContentPermissions();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [published, setPublished] = useState<'all' | 'true' | 'false'>('all');
  const [type, setType] = useState<'all' | ContentType>('all');

  const list = useQuery({
    queryKey: ['contents', page, q, published, type],
    queryFn: () =>
      listContents({
        page,
        pageSize: 10,
        q: q.trim() || undefined,
        published: published === 'all' ? undefined : published === 'true',
        type: type === 'all' ? undefined : type,
      }),
  });

  return (
    <WorkspaceShell title={t('content.title')}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field className="w-56">
          <FieldLabel htmlFor="q">{t('content.search')}</FieldLabel>
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
          <FieldLabel htmlFor="published">{t('content.published')}</FieldLabel>
          <Select
            value={published}
            items={[
              { value: 'all', label: t('content.all') },
              { value: 'true', label: t('content.publishedYes') },
              { value: 'false', label: t('content.draft') },
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
              <SelectItem value="all">{t('content.all')}</SelectItem>
              <SelectItem value="true">{t('content.publishedYes')}</SelectItem>
              <SelectItem value="false">{t('content.draft')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field className="w-44">
          <FieldLabel htmlFor="type">{t('content.type')}</FieldLabel>
          <Select
            value={type}
            items={[
              { value: 'all', label: t('content.all') },
              ...CONTENT_TYPES.map((value) => ({
                value,
                label: t(`content.types.${value}`),
              })),
            ]}
            onValueChange={(value) => {
              if (value !== 'all' && !CONTENT_TYPES.includes(value as ContentType)) {
                return;
              }
              setPage(1);
              setType(value as 'all' | ContentType);
            }}
          >
            <SelectTrigger id="type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('content.all')}</SelectItem>
              {CONTENT_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`content.types.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {canCreate ? (
          <Link className={buttonVariants()} to={paths.contentNew}>
            {t('content.create')}
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
                <Link className="font-medium hover:underline" to={paths.contentEdit(item.id)}>
                  {item.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {t(`content.types.${item.type}`)}
                  {` · ${item.published ? t('content.publishedYes') : t('content.draft')}`}
                  {item.knowledges.length > 0
                    ? ` · ${item.knowledges.map((knowledge) => knowledge.title).join(', ')}`
                    : ''}
                </p>
              </div>
              {canDelete ? (
                <ConfirmDeleteButton
                  onConfirm={() => {
                    void deleteContent(item.id)
                      .then(() => {
                        toast.success(t('common.deleted'));
                        void queryClient.invalidateQueries({ queryKey: ['contents'] });
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
          <p className="text-sm text-muted-foreground">{t('content.empty')}</p>
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
