import type { Metadata } from 'next';

import '@/styles/globals.css';
import { ToastProvider } from '@/components/feedback/ToastProvider';

export const metadata: Metadata = {
  title: 'Song Thanh Admin',
  description: 'Standalone content administration for Song Thanh'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
