import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { resetPassword } from '@/apis';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { paths } from '@/routers/paths';

type Values = {
  password: string;
  confirm: string;
};

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const form = useForm<Values>({
    defaultValues: { password: '', confirm: '' },
    resolver: (values, context, options) =>
      zodResolver(
        z
          .object({
            password: z.string().min(8, t('validation.passwordMin')),
            confirm: z.string().min(8, t('validation.confirmPassword')),
          })
          .refine((value) => value.password === value.confirm, {
            message: t('validation.passwordMismatch'),
            path: ['confirm'],
          }),
      )(values, context, options),
  });

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.resetTitle')}</CardTitle>
          <CardDescription>{t('auth.resetDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-destructive">
              {t('auth.missingToken')}
              <Link className="ml-2 text-primary hover:underline" to={paths.forgotPassword}>
                {t('auth.reapply')}
              </Link>
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  await resetPassword(token, values.password);
                  toast.success(t('auth.resetSuccess'));
                  void navigate(paths.login);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t('auth.resetFailed'));
                }
              })}
            >
              <Field>
                <FieldLabel htmlFor="password">{t('auth.newPassword')}</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('password')}
                />
                <FieldError>{form.formState.errors.password?.message}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm">{t('auth.confirmPassword')}</FieldLabel>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  {...form.register('confirm')}
                />
                <FieldError>{form.formState.errors.confirm?.message}</FieldError>
              </Field>
              <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
                {t('auth.saveNewPassword')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
