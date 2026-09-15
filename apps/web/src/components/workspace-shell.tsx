import { NavLink, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { paths } from '@/routers/paths';
import { useAuthStore } from '@/stores/auth-store';

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-2 text-sm',
    isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
  );

export function WorkspaceShell({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex min-h-svh">
      <aside className="flex w-52 shrink-0 flex-col gap-4 border-r bg-card p-4">
        <div>
          <p className="font-mono text-xs tracking-[0.24em] text-primary">{t('common.brand')}</p>
          <p className="mt-1 text-sm font-medium">{t('home.workspace')}</p>
        </div>
        <nav className="flex flex-col gap-1">
          <NavLink to={paths.knowledges} className={navClass}>
            {t('nav.knowledges')}
          </NavLink>
          <NavLink to={paths.questions} className={navClass}>
            {t('nav.questions')}
          </NavLink>
          <NavLink to={paths.collections} className={navClass}>
            {t('nav.collections')}
          </NavLink>
          <NavLink to={paths.categories} className={navClass}>
            {t('nav.categories')}
          </NavLink>
          <NavLink to={paths.tags} className={navClass}>
            {t('nav.tags')}
          </NavLink>
          <NavLink to={paths.home} end className={navClass}>
            {t('nav.account')}
          </NavLink>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b px-6 py-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Button
              variant="outline"
              onClick={() => {
                void logout().then(() => {
                  toast.success(t('home.loggedOut'));
                  void navigate(paths.login);
                });
              }}
            >
              {t('home.logout')}
            </Button>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
