import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trade Journal',
  description: 'Private futures trading journal — sessions, rules, stats.',
};

export const viewport: Viewport = {
  themeColor: '#101a2e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
