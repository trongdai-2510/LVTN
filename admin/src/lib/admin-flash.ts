export type AdminFlashPayload = {
  message: string;
  tone?: 'success' | 'info';
  resultType?: 'create-success' | 'success';
  listHref?: string;
  createHref?: string;
};

const ADMIN_FLASH_KEY = 'song-thanh-admin-flash';

export function pushAdminFlash(payload: AdminFlashPayload) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(ADMIN_FLASH_KEY, JSON.stringify(payload));
}

export function consumeAdminFlash(): AdminFlashPayload | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(ADMIN_FLASH_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(ADMIN_FLASH_KEY);
  try {
    const parsed = JSON.parse(raw) as AdminFlashPayload;
    if (!parsed || typeof parsed.message !== 'string' || !parsed.message.trim()) {
      return null;
    }
    return {
      message: parsed.message.trim(),
      tone: parsed.tone === 'info' ? 'info' : 'success',
      resultType:
        parsed.resultType === 'create-success' || parsed.resultType === 'success'
          ? parsed.resultType
          : undefined,
      listHref: typeof parsed.listHref === 'string' ? parsed.listHref : undefined,
      createHref: typeof parsed.createHref === 'string' ? parsed.createHref : undefined
    };
  } catch {
    return null;
  }
}
