import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { paths } from '@/routers/paths';
import { useAuthStore } from '@/stores/auth-store';

type Values = {
  email: string;
  password: string;
};

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const form = useForm<Values>({
    defaultValues: { email: '', password: '' },
    resolver: (values, context, options) =>
      zodResolver(
        z.object({
          email: z.string().email(t('validation.email')),
          password: z.string().min(8, t('validation.passwordMin')),
        }),
      )(values, context, options),
  });

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.loginTitle')}</CardTitle>
          <CardDescription>{t('auth.loginDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await login(values.email, values.password);
                toast.success(t('auth.loginSuccess'));
                void navigate(paths.home);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('auth.loginFailed'));
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="email">{t('common.email')}</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
              {form.formState.errors.email ? (
                <FieldError>{form.formState.errors.email.message}</FieldError>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('common.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <FieldError>{form.formState.errors.password.message}</FieldError>
              ) : null}
            </div>
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('auth.loggingIn') : t('auth.loginSubmit')}
            </Button>
          </form>
          <div className="mt-4 flex justify-between text-sm">
            <Link className="text-primary hover:underline" to={paths.forgotPassword}>
              {t('auth.forgotPassword')}
            </Link>
            <Link className="text-primary hover:underline" to={paths.register}>
              {t('auth.registerAccount')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
