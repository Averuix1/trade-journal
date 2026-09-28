'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_MAX_AGE, checkPassword, createSessionToken } from '@/lib/auth';

export type FormState = { error?: string; ok?: boolean; message?: string };

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const password = String(formData.get('password') ?? '');
  if (!process.env.APP_PASSWORD) {
    return { error: 'APP_PASSWORD is not set on the server. Add it in your environment variables.' };
  }
  if (!checkPassword(password)) return { error: 'Wrong password.' };

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  const next = String(formData.get('next') ?? '/');
  redirect(next.startsWith('/') ? next : '/');
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
