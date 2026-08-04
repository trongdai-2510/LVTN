import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';

import '@/styles/globals.css';
import { ToastProvider } from '@/components/feedback/ToastProvider';

export const metadata: Metadata = {
  title: 'Song Thanh Admin',
  description: 'Standalone content administration for Song Thanh'
};

const adminSans = IBM_Plex_Sans({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-admin-sans',
  weight: ['400', '500', '600', '700']
});

const adminMono = IBM_Plex_Mono({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-admin-mono',
  weight: ['400', '500', '600']
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${adminSans.variable} ${adminMono.variable}`} lang="vi">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
