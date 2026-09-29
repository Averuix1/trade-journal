import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import Script from 'next/script';
import { ThemeSync } from '@/components/theme-sync';
import { isThemePref, THEME_BOOT_SCRIPT, THEME_KEY, THEME_RESOLVED_KEY } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trade Journal',
  description: 'Private futures trading journal — sessions, rules, stats.',
};

export const viewport: Viewport = {
  themeColor: '#111114',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const prefCookie = jar.get(THEME_KEY)?.value;
  const pref = isThemePref(prefCookie) ? prefCookie : 'dark';
  const resolved = jar.get(THEME_RESOLVED_KEY)?.value;
  const light = resolved === 'light' || (resolved !== 'dark' && pref === 'light');

  return (
    <html lang="en" data-theme={light ? 'light' : undefined} data-theme-pref={pref} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Script id="theme-boot" strategy="beforeInteractive">
          {THEME_BOOT_SCRIPT}
        </Script>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
