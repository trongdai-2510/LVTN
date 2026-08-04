import type { Metadata } from 'next';

import { BrandPagePreviewClient } from './BrandPagePreviewClient';

export const metadata: Metadata = {
  title: 'Preview trang thuong hieu | Song Thanh',
  robots: {
    index: false,
    follow: false
  }
};

export default function BrandPagePreviewRoute() {
  return <BrandPagePreviewClient />;
}
