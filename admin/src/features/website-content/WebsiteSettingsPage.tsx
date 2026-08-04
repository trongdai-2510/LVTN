'use client';

import { type ComponentType, type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Clock,
  Globe2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Save,
  Share2,
  Trash2,
  X,
} from '@/components/icons';
import {
  FacebookBrand,
  GoogleMapsBrand,
  InstagramBrand,
  LinkedinBrand,
  TelegramBrand,
  TiktokBrand,
  TwitterXBrand,
  WebsiteGlobeBrand,
  WhatsappBrand,
  YoutubeBrand,
  ZaloBrand,
  getSocialBrandIcon,
} from '@/components/icons/SocialIcons';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { Field } from '@/components/form/Field';
import { FileReferencePicker } from '@/components/form/ReferencePickers';
import { apiClient } from '@/lib/api-client';
import { byId, endpoints } from '@/lib/api-endpoints';
import { extractItems, extractRecord } from '@/features/shared/extract';
import { PERMISSIONS } from '@/lib/permissions';
import { authStore } from '@/features/auth/auth.store';
import type { AuthState } from '@/features/auth/auth.types';

type Tab = 'company' | 'social' | 'map';
type SocialLink = {
  id: string;
  platform: string;
  label: string;
  url: string;
  status: string;
  sort_order: number;
  deleted_at?: string | null;
};
type RecordMap = Record<string, unknown>;

type BrandIcon = ComponentType<{ size?: number | string; className?: string }>;

const SOCIAL_PLATFORMS: { value: string; label: string; icon: BrandIcon }[] = [
  { value: 'facebook', label: 'Facebook', icon: FacebookBrand },
  { value: 'instagram', label: 'Instagram', icon: InstagramBrand },
  { value: 'youtube', label: 'YouTube', icon: YoutubeBrand },
  { value: 'tiktok', label: 'TikTok', icon: TiktokBrand },
  { value: 'zalo', label: 'Zalo', icon: ZaloBrand },
  { value: 'whatsapp', label: 'WhatsApp', icon: WhatsappBrand },
  { value: 'linkedin', label: 'LinkedIn', icon: LinkedinBrand },
  { value: 'twitter', label: 'X (Twitter)', icon: TwitterXBrand },
  { value: 'telegram', label: 'Telegram', icon: TelegramBrand },
  { value: 'google-maps', label: 'Google Maps', icon: GoogleMapsBrand },
  { value: 'website', label: 'Website', icon: WebsiteGlobeBrand },
];

const TABS: { id: Tab; label: string; icon: BrandIcon }[] = [
  { id: 'company', label: 'Thông tin công ty', icon: Building2 as BrandIcon },
  { id: 'social', label: 'Mạng xã hội', icon: Share2 as BrandIcon },
  { id: 'map', label: 'Giờ làm & Bản đồ', icon: MapPin as BrandIcon },
];

function getPlatformIcon(platform: string): BrandIcon {
  return getSocialBrandIcon(platform) as BrandIcon;
}

function mapSocialLinks(data: unknown): SocialLink[] {
  return extractItems(data).map((item) => ({
    id: String(item.id ?? ''),
    platform: String(item.platform ?? ''),
    label: String(item.label ?? item.name ?? ''),
    url: String(item.url ?? ''),
    status: String(item.status ?? 'active'),
    sort_order: Number(item.sort_order ?? 0),
    deleted_at: item.deleted_at ? String(item.deleted_at) : null,
  }));
}

function normalizeHotlines(record: RecordMap): string[] {
  const raw = record.hotlines;
  const fromArray = Array.isArray(raw)
    ? raw.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  if (fromArray.length > 0) return fromArray.slice(0, 5);
  const primary = String(record.hotline ?? '').trim();
  return primary ? [primary] : [''];
}

function getWebsiteUrl(links: SocialLink[]) {
  return links.find((link) => link.platform === 'website' && !link.deleted_at)?.url ?? '';
}

function extractSocialLinkRecord(data: unknown): RecordMap {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const record = data as RecordMap;
    if (record.social_link && typeof record.social_link === 'object' && !Array.isArray(record.social_link)) {
      return record.social_link as RecordMap;
    }
  }
  return extractRecord(data);
}

const DEFAULT_WORKING_DAYS = 'Thứ 2 – Thứ 6';

function formatTime(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : '';
}

function normalizeTimeForSave(value: unknown): string | null {
  const str = String(value ?? '').trim();
  if (!str) return null;
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(str)) return str;
  if (/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(str)) return str;
  throw new Error('Giờ làm việc phải theo dạng HH:MM.');
}

function extractMapSrc(value: unknown): string {
  const input = String(value ?? '').trim();
  if (!input) return '';
  const iframeMatch = input.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
  return iframeMatch?.[1] ?? input;
}

function isEmbeddableMapSrc(src: string): boolean {
  if (!src.trim()) return false;
  try {
    const url = new URL(src.trim());
    return url.origin === 'https://www.google.com' && url.pathname === '/maps/embed';
  } catch {
    return false;
  }
}

export function WebsiteSettingsPage() {
  const [authState, setAuthState] = useState<AuthState>(() => authStore.getState());
  const [tab, setTab] = useState<Tab>('company');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [form, setForm] = useState<RecordMap>({});
  const [hotlines, setHotlines] = useState<string[]>(['']);
  const [websiteUrl, setWebsiteUrl] = useState('');

  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [newLink, setNewLink] = useState({ platform: 'facebook', url: '' });
  const [deleteLinkId, setDeleteLinkId] = useState<string | null>(null);
  const [deletingLink, setDeletingLink] = useState(false);
  const [togglingLinkId, setTogglingLinkId] = useState<string | null>(null);

  const canUpdate = authState.permissions.includes(PERMISSIONS.websiteSettingsUpdate);
  const canCreateLink = authState.permissions.includes(PERMISSIONS.websiteSettingsSocialLinkCreate);
  const canUpdateLink = authState.permissions.includes(PERMISSIONS.websiteSettingsSocialLinkUpdate);
  const canArchiveLink = authState.permissions.includes(PERMISSIONS.websiteSettingsSocialLinkArchive);

  useEffect(() => {
    setAuthState(authStore.hydrate());
    return authStore.subscribe(setAuthState);
  }, []);

  const applySettingsRecord = useCallback((record: RecordMap) => {
    setForm({
      ...record,
      working_hours_from: formatTime(typeof record.working_hours_from === 'string' ? record.working_hours_from : null),
      working_hours_to: formatTime(typeof record.working_hours_to === 'string' ? record.working_hours_to : null),
      working_days: String(record.working_days ?? '').trim() || DEFAULT_WORKING_DAYS,
      map_embed_code: extractMapSrc(record.map_embed_code),
    });
    setHotlines(normalizeHotlines(record));
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResult, socialResult] = await Promise.allSettled([
        apiClient.get<unknown>(endpoints.songThanh.websiteSettings),
        apiClient.get<unknown>(`${endpoints.songThanh.socialLinks}?deleted_scope=active`),
      ]);

      if (settingsResult.status === 'fulfilled') {
        applySettingsRecord(extractRecord(settingsResult.value));
      } else {
        setError('Không tải được cài đặt website.');
      }

      if (socialResult.status === 'fulfilled') {
        const links = mapSocialLinks(socialResult.value);
        setSocialLinks(links);
        setWebsiteUrl(getWebsiteUrl(links));
      }
    } catch {
      setError('Không tải được dữ liệu.');
    } finally {
      setLoading(false);
    }
  }, [applySettingsRecord]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateField(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateHotline(index: number, value: string) {
    setHotlines((items) => items.map((item, i) => (i === index ? value : item)));
  }

  function removeHotline(index: number) {
    setHotlines((items) => {
      const next = items.filter((_, i) => i !== index);
      return next.length > 0 ? next : [''];
    });
  }

  function addHotline() {
    setHotlines((items) => (items.length >= 5 ? items : [...items, '']));
  }

  async function syncWebsiteLink(nextUrl: string, currentLinks: SocialLink[]) {
    const existing = currentLinks.find((link) => link.platform === 'website' && !link.deleted_at);
    if (nextUrl) {
      if (existing && canUpdateLink) {
        const result = await apiClient.put<unknown>(byId(endpoints.songThanh.socialLinks, existing.id), {
          platform: 'website',
          label: existing.label || 'Website',
          url: nextUrl,
          sort_order: existing.sort_order,
          status: existing.status === 'inactive' ? 'inactive' : 'active',
        });
        const updated = extractSocialLinkRecord(result);
        setSocialLinks((links) => links.map((link) => (
          link.id === existing.id
            ? { ...link, label: String(updated.label ?? link.label), url: String(updated.url ?? nextUrl), status: String(updated.status ?? 'active') }
            : link
        )));
      } else if (!existing && canCreateLink) {
        const result = await apiClient.post<unknown>(endpoints.songThanh.socialLinks, {
          platform: 'website',
          label: 'Website',
          url: nextUrl,
          sort_order: 0,
          status: 'active',
        });
        const rec = extractSocialLinkRecord(result);
        setSocialLinks((links) => [
          ...links,
          {
            id: String(rec.id ?? Date.now()),
            platform: String(rec.platform ?? 'website'),
            label: String(rec.label ?? 'Website'),
            url: String(rec.url ?? nextUrl),
            status: String(rec.status ?? 'active'),
            sort_order: Number(rec.sort_order ?? 0),
            deleted_at: null,
          },
        ]);
      }
      return;
    }

    if (existing && canArchiveLink) {
      await apiClient.post(`${byId(endpoints.songThanh.socialLinks, existing.id)}/archive`, {});
      setSocialLinks((links) => links.filter((link) => link.id !== existing.id));
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!canUpdate) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const cleanHotlines = hotlines.map((item) => item.trim()).filter(Boolean).slice(0, 5);
      if (cleanHotlines.length === 0) {
        throw new Error('Cần ít nhất một số điện thoại.');
      }
      const mapSrc = extractMapSrc(form.map_embed_code);
      const payload = {
        display_name: String(form.display_name ?? '').trim(),
        legal_name: String(form.legal_name ?? '').trim(),
        hotline: cleanHotlines[0],
        hotlines: cleanHotlines,
        email: String(form.email ?? '').trim(),
        address: String(form.address ?? '').trim(),
        map_embed_code: mapSrc || null,
        working_hours_from: normalizeTimeForSave(form.working_hours_from),
        working_hours_to: normalizeTimeForSave(form.working_hours_to),
        working_days: String(form.working_days ?? '').trim() || null,
        logo_file_id: form.logo_file_id ? String(form.logo_file_id) : null,
        favicon_file_id: form.favicon_file_id ? String(form.favicon_file_id) : null,
      };

      const result = await apiClient.put<unknown>(endpoints.songThanh.websiteSettings, payload);
      applySettingsRecord(extractRecord(result));
      const responseLinks = mapSocialLinks(result);
      if (responseLinks.length > 0) setSocialLinks(responseLinks);
      await syncWebsiteLink(websiteUrl.trim(), responseLinks.length > 0 ? responseLinks : socialLinks);
      setSaveMsg('Đã lưu thành công.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Không lưu được.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLink() {
    if (!canCreateLink || !newLink.url.trim()) return;
    setSocialLoading(true);
    try {
      const platformLabel = SOCIAL_PLATFORMS.find((p) => p.value === newLink.platform)?.label ?? newLink.platform;
      const result = await apiClient.post<RecordMap>(endpoints.songThanh.socialLinks, {
        platform: newLink.platform,
        label: platformLabel,
        url: newLink.url,
        status: 'active',
      });
      const rec = extractSocialLinkRecord(result);
      setSocialLinks((prev) => [
        ...prev,
        {
          id: String(rec.id ?? Date.now()),
          platform: String(rec.platform ?? newLink.platform),
          label: String(rec.label ?? platformLabel),
          url: String(rec.url ?? newLink.url),
          status: 'active',
          sort_order: Number(rec.sort_order ?? 0),
          deleted_at: null,
        },
      ]);
      setNewLink({ platform: 'facebook', url: '' });
      setAddingLink(false);
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleDeleteLink(linkId: string) {
    setDeletingLink(true);
    try {
      await apiClient.post(`${byId(endpoints.songThanh.socialLinks, linkId)}/archive`, {});
      setSocialLinks((prev) => prev.filter((l) => l.id !== linkId));
      setDeleteLinkId(null);
    } finally {
      setDeletingLink(false);
    }
  }

  async function handleToggleLink(link: SocialLink) {
    if (!canUpdateLink || togglingLinkId) return;

    const nextStatus = link.status === 'active' ? 'inactive' : 'active';
    setTogglingLinkId(link.id);
    setSaveMsg('');
    try {
      const result = await apiClient.put<unknown>(
        byId(endpoints.songThanh.socialLinks, link.id),
        { status: nextStatus }
      );
      const updated = extractSocialLinkRecord(result);
      setSocialLinks((items) =>
        items.map((item) =>
          item.id === link.id
            ? { ...item, status: String(updated.status ?? nextStatus) }
            : item
        )
      );
      setSaveMsg(nextStatus === 'active' ? 'Đã bật liên kết.' : 'Đã tắt liên kết.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Không đổi được trạng thái liên kết.');
    } finally {
      setTogglingLinkId(null);
    }
  }

  const workingHoursPreview = useMemo(() => {
    const previewDays = String(form.working_days ?? '').trim() || DEFAULT_WORKING_DAYS;
    const fromTime = formatTime(typeof form.working_hours_from === 'string' ? form.working_hours_from : null);
    const toTime = formatTime(typeof form.working_hours_to === 'string' ? form.working_hours_to : null);
    if (!fromTime || !toTime) return 'Chưa thiết lập đầy đủ';
    return `${previewDays}: ${fromTime} – ${toTime}`;
  }, [form.working_days, form.working_hours_from, form.working_hours_to]);

  const mapSrc = extractMapSrc(form.map_embed_code);
  const canPreviewMap = isEmbeddableMapSrc(mapSrc);

  if (loading) return <SettingsSkeleton />;
  if (error) return <ErrorState message={error} />;

  return (
    <section className="admin-page">
      <div>
        <h1 className="text-2xl font-semibold leading-8 tracking-tight text-text">Cài đặt website</h1>
        <p className="mt-1 text-sm text-[#444653]">
          Thông tin công ty, mạng xã hội và thông tin liên hệ.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors ${
                tab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-text'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSave}>
        {tab === 'company' && (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-4">
            <Card>
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Thông tin cơ bản</h2>
              </div>
              <div className="admin-card-body admin-form-stack">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Tên hiển thị" htmlFor="display-name">
                    <Input
                      id="display-name"
                      value={String(form.display_name ?? '')}
                      onChange={(e) => updateField('display_name', e.target.value)}
                      placeholder="Song Thanh"
                      readOnly={!canUpdate}
                    />
                  </Field>
                  <Field label="Tên pháp nhân" htmlFor="legal-name">
                    <Input
                      id="legal-name"
                      value={String(form.legal_name ?? '')}
                      onChange={(e) => updateField('legal_name', e.target.value)}
                      placeholder="Công ty TNHH Song Thanh"
                      readOnly={!canUpdate}
                    />
                  </Field>
                </div>
                <Field label="Địa chỉ" htmlFor="address">
                  <Textarea
                    id="address"
                    value={String(form.address ?? '')}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder="Số nhà, đường, phường, quận, thành phố"
                    rows={3}
                    readOnly={!canUpdate}
                  />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Email" htmlFor="email">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        className="pl-9"
                        value={String(form.email ?? '')}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="info@songthanh.vn"
                        readOnly={!canUpdate}
                      />
                    </div>
                  </Field>
                  <Field label="Website" htmlFor="website">
                    <div className="relative">
                      <Globe2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="website"
                        className="pl-9"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://songthanh.vn"
                        readOnly={!canUpdate}
                      />
                    </div>
                  </Field>
                </div>
              </div>
            </Card>

            <Card>
              <div className="admin-card-header">
                <div>
                  <h2 className="text-sm font-semibold text-text">Hình ảnh thương hiệu</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Logo và favicon hiển thị trên trình duyệt.</p>
                </div>
              </div>
              <div className="admin-card-body grid gap-4 md:grid-cols-2">
                <Field label="Logo" htmlFor="brand-logo">
                  <FileReferencePicker
                    inputId="brand-logo"
                    fieldLabel="Logo"
                    preferredGroup="website_config"
                    allowedMimePrefix="image/"
                    value={String(form.logo_file_id ?? '')}
                    readOnly={!canUpdate}
                    onChange={(v) => updateField('logo_file_id', v)}
                  />
                </Field>
                <Field label="Favicon" htmlFor="brand-favicon">
                  <FileReferencePicker
                    inputId="brand-favicon"
                    fieldLabel="Favicon"
                    preferredGroup="website_config"
                    allowedMimePrefix="image/"
                    value={String(form.favicon_file_id ?? '')}
                    readOnly={!canUpdate}
                    onChange={(v) => updateField('favicon_file_id', v)}
                  />
                </Field>
              </div>
            </Card>
            </div>

            <div className="space-y-4">
            <Card>
              <div className="admin-card-header">
                <div>
                  <h2 className="text-sm font-semibold text-text">Số điện thoại</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Có thể thêm nhiều số</p>
                </div>
              </div>
              <div className="admin-card-body space-y-3">
                {hotlines.map((phone, index) => (
                  <div key={`hotline-${index}`} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        value={phone}
                        onChange={(e) => updateHotline(index, e.target.value)}
                        placeholder="0901 234 567"
                        readOnly={!canUpdate}
                      />
                    </div>
                    {hotlines.length > 1 && (
                      <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 md:h-8 md:w-8"
                        onClick={() => removeHotline(index)}
                        disabled={!canUpdate}
                        aria-label="Xóa số điện thoại"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addHotline}
                  disabled={!canUpdate || hotlines.length >= 5}
                  className="inline-flex min-h-11 items-center rounded-sm px-1 text-sm font-medium text-primary disabled:cursor-not-allowed disabled:opacity-45 md:min-h-8"
                >
                  + Thêm số
                </button>
              </div>
            </Card>
            </div>
          </div>
        )}

        {tab === 'social' && (
          <Card>
            <div className="admin-card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">Mạng xã hội</h2>
              {canCreateLink && !addingLink && (
                <Button type="button" variant="secondary" size="sm" onClick={() => setAddingLink(true)}>
                  <Plus size={14} className="mr-1" />
                  Thêm
                </Button>
              )}
            </div>

            <div className="divide-y divide-border">
              {addingLink && (() => {
                const PreviewIcon = getPlatformIcon(newLink.platform);
                return (
                <div className="space-y-3 bg-muted/20 px-5 py-4">
                  <div className="grid gap-2 md:grid-cols-[48px_180px_minmax(280px,1fr)]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-background">
                      <PreviewIcon size={20} />
                    </div>
                    <Select
                      value={newLink.platform}
                      onChange={(e) => setNewLink((f) => ({ ...f, platform: e.target.value }))}
                    >
                      {SOCIAL_PLATFORMS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </Select>
                    <Input
                      placeholder="https://..."
                      value={newLink.url}
                      onChange={(e) => setNewLink((f) => ({ ...f, url: e.target.value }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={handleAddLink} disabled={socialLoading || !newLink.url.trim()}>
                      {socialLoading ? 'Đang thêm...' : 'Thêm'}
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => setAddingLink(false)}>
                      Hủy
                    </Button>
                  </div>
                </div>
                );
              })()}

              {socialLinks.length === 0 && !addingLink ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <div className="rounded-sm bg-muted p-3 text-muted-foreground">
                    <Share2 size={20} />
                  </div>
                  <p className="text-sm text-muted-foreground">Chưa có liên kết mạng xã hội nào.</p>
                </div>
              ) : (
                socialLinks.map((link) => {
                  const Icon = getPlatformIcon(link.platform);
                  return (
                    <div key={link.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-background">
                        <Icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-text">{link.label || link.platform}</div>
                        <div className="truncate text-xs text-muted-foreground">{link.url}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={link.status === 'active'}
                        aria-label={`${link.status === 'active' ? 'Tắt' : 'Bật'} ${link.label || link.platform}`}
                        title={canUpdateLink ? 'Bật hoặc tắt hiển thị trên website' : 'Không có quyền cập nhật'}
                        disabled={!canUpdateLink || togglingLinkId === link.id}
                        onClick={() => void handleToggleLink(link)}
                        className="inline-flex shrink-0 items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {togglingLinkId === link.id
                            ? 'Đang lưu'
                            : link.status === 'active'
                              ? 'Bật'
                              : 'Tắt'}
                        </span>
                        <span
                          className={`relative block h-5 w-9 rounded-full transition-colors ${
                            link.status === 'active' ? 'bg-primary' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                              link.status === 'active' ? 'translate-x-[18px]' : 'translate-x-0.5'
                            }`}
                          />
                        </span>
                      </button>
                      {canArchiveLink && (
                        <button
                          type="button"
                          onClick={() => setDeleteLinkId(link.id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-red-600"
                          aria-label="Lưu trữ liên kết"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        )}

        {tab === 'map' && (
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(420px,1.15fr)]">
            <Card>
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Giờ làm việc</h2>
              </div>
              <div className="admin-card-body admin-form-stack">
                <div className="rounded-sm border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                  Hiển thị trên website: <span className="font-medium">{workingHoursPreview}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Từ giờ" htmlFor="hours-from">
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="hours-from"
                        type="time"
                        className="pl-9"
                        value={String(form.working_hours_from ?? '')}
                        onChange={(e) => updateField('working_hours_from', e.target.value)}
                        placeholder="HH:MM"
                        readOnly={!canUpdate}
                      />
                    </div>
                  </Field>
                  <Field label="Đến giờ" htmlFor="hours-to">
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="hours-to"
                        type="time"
                        className="pl-9"
                        value={String(form.working_hours_to ?? '')}
                        onChange={(e) => updateField('working_hours_to', e.target.value)}
                        placeholder="HH:MM"
                        readOnly={!canUpdate}
                      />
                    </div>
                  </Field>
                </div>
                <Field
                  label="Ngày làm việc"
                  htmlFor="working-days"
                  hint="Hiển thị nguyên văn - ví dụ: Thứ 2 – Thứ 7"
                >
                  <Input
                    id="working-days"
                    value={String(form.working_days ?? '')}
                    maxLength={50}
                    onChange={(e) => updateField('working_days', e.target.value)}
                    placeholder="Thứ 2 – Thứ 6"
                    readOnly={!canUpdate}
                  />
                </Field>
              </div>
            </Card>

            <Card>
              <div className="admin-card-header">
                <h2 className="text-sm font-semibold text-text">Bản đồ Google Maps</h2>
              </div>
              <div className="admin-card-body admin-form-stack">
                <div className="overflow-hidden rounded border border-border bg-muted">
                  {canPreviewMap ? (
                    <iframe
                      className="aspect-video w-full border-0"
                      src={mapSrc}
                      title="Bản đồ Google Maps"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  ) : (
                    <div className="flex aspect-video flex-col items-center justify-center gap-2 text-muted-foreground">
                      <MapPin size={24} />
                      <span className="text-sm">Chưa có bản đồ</span>
                    </div>
                  )}
                </div>
                <Field
                  label="Liên kết bản đồ"
                  htmlFor="map-embed"
                  hint="Vào Google Maps → Chia sẻ → Sao chép liên kết → dán vào đây"
                >
                  <Textarea
                    id="map-embed"
                    value={String(form.map_embed_code ?? '')}
                    onChange={(e) => updateField('map_embed_code', extractMapSrc(e.target.value))}
                    placeholder="Dán link Google Maps..."
                    rows={4}
                    readOnly={!canUpdate}
                  />
                </Field>
              </div>
            </Card>
          </div>
        )}

        {tab !== 'social' && canUpdate && (
          <div className="sticky bottom-0 z-10 mt-4 border-t border-border bg-panel px-5 py-3 shadow-[0_-8px_18px_rgb(15_23_42_/_0.04)]">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-muted-foreground">
                {saveMsg || 'Thay đổi sẽ được lưu khi bạn nhấn Lưu.'}
              </p>
              <Button type="submit" disabled={saving}>
                <Save size={14} className="mr-1.5" />
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </div>
          </div>
        )}
      </form>

      <ConfirmDialog
        open={deleteLinkId !== null}
        title="Xóa liên kết"
        description="Bạn có chắc muốn xóa liên kết mạng xã hội này không?"
        confirmLabel={deletingLink ? 'Đang xóa...' : 'Xóa'}
        tone="danger"
        onConfirm={() => deleteLinkId && handleDeleteLink(deleteLinkId)}
        onClose={() => setDeleteLinkId(null)}
      />
    </section>
  );
}

function SettingsSkeleton() {
  return (
    <div className="admin-page">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-1 h-4 w-72" />
      </div>
      <div className="flex gap-1 border-b border-border pb-px">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-8 w-32" />)}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {[0, 1].map((i) => (
          <Card key={i}>
            <div className="admin-card-header"><Skeleton className="h-5 w-32" /></div>
            <div className="admin-card-body admin-form-stack">
              {[0, 1, 2].map((j) => (
                <div key={j} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

