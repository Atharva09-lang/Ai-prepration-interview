'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from './Button';
import { Input } from './Input';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

export function AuthForm({ mode }) {
  const { login, register } = useAuth();
  const router = useRouter();
  const isRegister = mode === 'register';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);

  function validate() {
    const errs = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (password.length < 8) errs.password = 'Password must be at least 8 characters.';
    else if (password.length > 72) errs.password = 'Password must be 72 characters or fewer.';
    if (isRegister && confirm !== password) errs.confirm = 'Passwords do not match.';
    return errs;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const found = validate();
    setFieldErrors(found);
    setError(null);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      if (isRegister) await register(email.trim(), password);
      else await login(email.trim(), password);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.length) {
          const map = {};
          for (const d of err.details) {
            const field = d.path.split('.').pop() ?? d.path;
            if (!map[field]) map[field] = d.message;
          }
          setFieldErrors(map);
        }
        // Keep the message friendly; do not surface raw backend internals.
        setError(err.code === 'INVALID_CREDENTIALS' ? 'Incorrect email or password.' : err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 px-3.5 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        required
      />

      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        hint={isRegister ? 'Minimum 8 characters.' : undefined}
        required
      />

      {isRegister && (
        <Input
          label="Confirm password"
          type="password"
          name="confirm"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={fieldErrors.confirm}
          required
        />
      )}

      <Button type="submit" size="lg" className="w-full" loading={busy}>
        {isRegister ? 'Create Account' : 'Login'}
      </Button>

      <p className="text-center text-sm text-muted">
        {isRegister ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Login
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
