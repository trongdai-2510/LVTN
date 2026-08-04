'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';

export function UnsavedChangesGuard({
  when,
  title = 'Rời trang khi chưa lưu?',
  description = 'Các thay đổi chưa lưu sẽ bị mất. Bạn có chắc muốn tiếp tục?',
  confirmLabel = 'Rời trang'
}: {
  when: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (!when) {
      confirmedRef.current = false;
      setPendingHref(null);
    }
  }, [when]);

  useEffect(() => {
    if (!when) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (confirmedRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (confirmedRef.current) return;
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.getAttribute('target') && anchor.getAttribute('target') !== '_self') return;
      if (anchor.dataset.bypassUnsavedGuard === 'true') return;

      const nextUrl = new URL(anchor.href, window.location.href);
      const currentUrl = new URL(window.location.href);

      if (
        nextUrl.origin === currentUrl.origin &&
        nextUrl.pathname === currentUrl.pathname &&
        nextUrl.search === currentUrl.search
      ) {
        return;
      }

      event.preventDefault();
      setPendingHref(nextUrl.toString());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [when]);

  function confirmLeave() {
    const href = pendingHref;
    if (!href) return;

    confirmedRef.current = true;
    setPendingHref(null);

    const nextUrl = new URL(href);
    if (nextUrl.origin === window.location.origin) {
      router.push(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      return;
    }

    window.location.assign(href);
  }

  return (
    <ConfirmDialog
      open={Boolean(pendingHref)}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      tone="warning"
      onClose={() => setPendingHref(null)}
      onConfirm={confirmLeave}
    />
  );
}
