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
  name: string;
  email: string;
  password: string;
};

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const registerUser = useAuthStore((state) => state.register);
  const form = useForm<Values>({
    defaultValues: { name: '', email: '', password: '' },
    resolver: (values, context, options) =>
      zodResolver(
        z.object({
          name: z.string().min(1, t('validation.nameRequired')),
          email: z.string().email(t('validation.email')),
          password: z.string().min(8, t('validation.passwordMin')),
        }),
      )(values, context, options),
  });

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.registerTitle')}</CardTitle>
          <CardDescription>{t('auth.registerDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await registerUser(values.name, values.email, values.password);
                toast.success(t('auth.registerSuccess'));
                void navigate(paths.home);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : t('auth.registerFailed'));
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="name">{t('common.name')}</Label>
              <Input id="name" autoComplete="name" {...form.register('name')} />
              {form.formState.errors.name ? (
                <FieldError>{form.formState.errors.name.message}</FieldError>
              ) : null}
            </div>
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
                autoComplete="new-password"
                {...form.register('password')}
              />
              {form.formState.errors.password ? (
                <FieldError>{form.formState.errors.password.message}</FieldError>
              ) : null}
            </div>
            <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('auth.registering') : t('auth.registerSubmit')}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link className="text-primary hover:underline" to={paths.login}>
              {t('auth.goLogin')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
