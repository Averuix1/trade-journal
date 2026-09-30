import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import Script from 'next/script';
import { ThemeSync } from '@/components/theme-sync';
import { serverTheme, THEME_BOOT_SCRIPT, THEME_KEY, THEME_RESOLVED_KEY } from '@/lib/theme';
import './globals.css';

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Super-Journal',
  description: 'Private futures trading journal — sessions, rules, stats.',
};

export const viewport: Viewport = {
  themeColor: '#050806',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const { pref, resolved } = serverTheme(jar.get(THEME_KEY)?.value, jar.get(THEME_RESOLVED_KEY)?.value);

  return (
    <html
      lang="en"
      className={jetbrains.variable}
      data-theme={resolved}
      data-theme-pref={pref}
      suppressHydrationWarning
    >
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
