import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { paths } from '@/routers/paths';
import { useAuthStore } from '@/stores/auth-store';

type Values = {
  currentPassword: string;
  newPassword: string;
  confirm: string;
};

export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const logout = useAuthStore((state) => state.logout);
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const form = useForm<Values>({
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
    resolver: (values, context, options) =>
      zodResolver(
        z
          .object({
            currentPassword: z.string().min(8, t('validation.currentPasswordMin')),
            newPassword: z.string().min(8, t('validation.newPasswordMin')),
            confirm: z.string().min(8, t('validation.confirmNewPassword')),
          })
          .refine((value) => value.newPassword === value.confirm, {
            message: t('validation.passwordMismatch'),
            path: ['confirm'],
          }),
      )(values, context, options),
  });

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between border-l-4 border-primary pl-4">
        <div>
          <p className="font-mono text-xs tracking-[0.24em] text-primary">{t('common.brand')}</p>
          <h1 className="text-2xl font-semibold">{t('home.workspace')}</h1>
        </div>
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

      <Card>
        <CardHeader>
          <CardTitle>{t('home.currentAccount')}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{t('home.nameLabel', { name: user?.name })}</p>
          <p className="text-muted-foreground">
            {t('home.permissionsLabel', {
              codes: permissionCodes.join(', ') || t('common.none'),
            })}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('home.updatePassword')}</CardTitle>
          <CardDescription>{t('home.updatePasswordHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await updatePassword(values.currentPassword, values.newPassword);
                form.reset();
                toast.success(t('home.passwordUpdated'));
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('home.updateFailed'));
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('home.currentPassword')}</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                {...form.register('currentPassword')}
              />
              {form.formState.errors.currentPassword ? (
                <FieldError>{form.formState.errors.currentPassword.message}</FieldError>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                {...form.register('newPassword')}
              />
              {form.formState.errors.newPassword ? (
                <FieldError>{form.formState.errors.newPassword.message}</FieldError>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t('home.confirmNewPassword')}</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                {...form.register('confirm')}
              />
              {form.formState.errors.confirm ? (
                <FieldError>{form.formState.errors.confirm.message}</FieldError>
              ) : null}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('home.savePassword')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
