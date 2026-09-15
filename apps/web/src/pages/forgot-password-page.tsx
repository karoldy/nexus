import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { requestPasswordReset } from '@/apis';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { paths } from '@/routers/paths';

type Values = {
  email: string;
};

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const form = useForm<Values>({
    defaultValues: { email: '' },
    resolver: (values, context, options) =>
      zodResolver(z.object({ email: z.string().email(t('validation.email')) }))(
        values,
        context,
        options,
      ),
  });

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>{t('auth.forgotTitle')}</CardTitle>
          <CardDescription>{t('auth.forgotDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <p className="text-sm text-muted-foreground">
              {t('auth.forgotSent')}
              <Link className="ml-2 text-primary hover:underline" to={paths.login}>
                {t('auth.backToLogin')}
              </Link>
            </p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                try {
                  await requestPasswordReset(values.email);
                  toast.success(t('auth.resetSent'));
                  setDone(true);
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t('auth.requestFailed'));
                }
              })}
            >
              <Field>
                <FieldLabel htmlFor="email">{t('common.email')}</FieldLabel>
                <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
              </Field>
              <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
                {t('auth.sendReset')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </AuthShell>
  );
}
