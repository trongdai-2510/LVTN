import type { Metadata } from 'next';
import { Archivo, Be_Vietnam_Pro } from 'next/font/google';

import '@/styles/globals.css';
import { ToastProvider } from '@/components/feedback/ToastProvider';

export const metadata: Metadata = {
  title: 'Song Thanh Admin',
  description: 'Standalone content administration for Song Thanh'
};

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-be-vietnam-pro',
  weight: ['400', '500', '600', '700']
});

const archivo = Archivo({
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  preload: false,
  variable: '--font-archivo',
  weight: ['600', '700', '800']
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${beVietnamPro.variable} ${archivo.variable}`} lang="vi">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
