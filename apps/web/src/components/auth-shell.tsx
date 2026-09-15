import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/language-switcher';

export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-20 shrink-0 bg-primary md:block" aria-hidden />
      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <LanguageSwitcher className="absolute right-4 top-4" />
        <div className="w-full max-w-md">
          <p className="mb-6 font-mono text-xs tracking-[0.28em] text-primary">
            {t('auth.kicker')}
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}
