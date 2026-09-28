'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { login, type FormState } from '@/lib/actions/auth';

const initial: FormState = {};

export default function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="card card-pad space-y-4">
      <input type="hidden" name="next" value={params.get('next') ?? '/'} />
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          className="field"
          placeholder="••••••••"
        />
      </div>
      {state.error && (
        <p className="rounded-lg border border-[#7a2331] bg-[#3a1119] px-3 py-2 text-sm text-[#ff9aa3]">{state.error}</p>
      )}
      <button className="btn btn-primary w-full" type="submit" disabled={pending}>
        {pending ? 'Checking…' : 'Sign in'}
      </button>
      <p className="text-center text-xs text-dim">Set by the APP_PASSWORD environment variable.</p>
    </form>
  );
}
