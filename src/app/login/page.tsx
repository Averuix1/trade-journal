import { Suspense } from 'react';
import { MatrixField } from '@/components/matrix-field';
import LoginForm from './login-form';

export const metadata = { title: 'Sign in — Super-Journal' };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <MatrixField />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="wordmark mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-ink-900 text-sm font-semibold tracking-[0.14em] text-fg">
            SJ
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-fg-strong">Super-Journal</h1>
          <p className="mt-1 text-sm text-dim">Private desk. One password.</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
