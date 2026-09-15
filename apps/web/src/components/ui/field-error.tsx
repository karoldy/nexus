import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function FieldError({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-destructive', className)} {...props} />;
}
