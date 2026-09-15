import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { WorkspaceShell } from '@/components/workspace-shell';
import { paths } from '@/routers/paths';
import { useAuthStore } from '@/stores/auth-store';

type Values = {
  currentPassword: string;
  newPassword: string;
  confirm: string;
};

export function HomePage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
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
    <WorkspaceShell title={t('nav.account')}>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <Link className={buttonVariants()} to={paths.knowledges}>
          {t('home.goKnowledges')}
        </Link>
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
    </WorkspaceShell>
  );
}
