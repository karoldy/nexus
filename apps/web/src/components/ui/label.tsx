import { Field } from '@base-ui/react/field';
import { cn } from '@/lib/utils';

export function Label({ className, ...props }: Field.Label.Props) {
  return (
    <Field.Label
      className={cn(
        'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      {...props}
    />
  );
}
