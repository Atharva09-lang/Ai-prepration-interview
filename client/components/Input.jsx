'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef(function Input(
  { label, hint, error, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cn(
          'w-full rounded-md border bg-card px-3.5 py-2.5 text-sm text-ink',
          'placeholder:text-muted/70 transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
