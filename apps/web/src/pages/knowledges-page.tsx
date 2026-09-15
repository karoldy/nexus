import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { deleteKnowledge, listKnowledges } from '@/apis';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/form-controls';
import { WorkspaceShell } from '@/components/workspace-shell';
import { useKnowledgePermissions } from '@/hooks/use-knowledge-permissions';
import { paths } from '@/routers/paths';

export function KnowledgesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { canCreate, canDelete } = useKnowledgePermissions();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [published, setPublished] = useState<'all' | 'true' | 'false'>('all');

  const list = useQuery({
    queryKey: ['knowledges', page, q, published],
    queryFn: () =>
      listKnowledges({
        page,
        pageSize: 10,
        q: q.trim() || undefined,
        published: published === 'all' ? undefined : published === 'true',
      }),
  });

  return (
    <WorkspaceShell title={t('knowledge.title')}>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm" htmlFor="q">
            {t('knowledge.search')}
          </label>
          <Input
            id="q"
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="published">
            {t('knowledge.published')}
          </label>
          <Select
            id="published"
            value={published}
            onChange={(event) => {
              setPage(1);
              setPublished(event.target.value as 'all' | 'true' | 'false');
            }}
          >
            <option value="all">{t('knowledge.all')}</option>
            <option value="true">{t('knowledge.publishedYes')}</option>
            <option value="false">{t('knowledge.draft')}</option>
          </Select>
        </div>
        {canCreate ? (
          <Link className={buttonVariants()} to={paths.knowledgeNew}>
            {t('knowledge.create')}
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
                <Link className="font-medium hover:underline" to={paths.knowledgeEdit(item.id)}>
                  {item.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {item.published ? t('knowledge.publishedYes') : t('knowledge.draft')}
                  {item.category ? ` · ${item.category.name}` : ''}
                  {item.tags.length > 0 ? ` · ${item.tags.map((tag) => tag.name).join(', ')}` : ''}
                </p>
              </div>
              {canDelete ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!window.confirm(t('common.confirmDelete'))) {
                      return;
                    }
                    void deleteKnowledge(item.id)
                      .then(() => {
                        toast.success(t('common.deleted'));
                        void queryClient.invalidateQueries({ queryKey: ['knowledges'] });
                      })
                      .catch((error: unknown) => {
                        toast.error(
                          error instanceof Error ? error.message : t('common.deleteFailed'),
                        );
                      });
                  }}
                >
                  {t('common.delete')}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {list.isSuccess && list.data.records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('knowledge.empty')}</p>
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
