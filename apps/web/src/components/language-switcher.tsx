import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { appLanguages } from '@/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {appLanguages.map((language) => (
        <Button
          key={language}
          type="button"
          size="sm"
          variant={current === language ? 'default' : 'ghost'}
          onClick={() => {
            void i18n.changeLanguage(language);
          }}
        >
          {t(`language.${language}`)}
        </Button>
      ))}
    </div>
  );
}
