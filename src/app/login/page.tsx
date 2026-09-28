import { Suspense } from 'react';
import LoginForm from './login-form';

export const metadata = { title: 'Sign in — Trade Journal' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-mint-500/40 bg-mint-500/10 text-xl font-bold text-mint-200">
            TJ
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#eafff7]">Trade Journal</h1>
          <p className="mt-1 text-sm text-dim">Private desk. One password.</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
