import type { ReactNode } from 'react';

import {
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon
} from '@/components/ui/ContactIcons';
import { EmptyMedia } from '@/components/ui/EmptyMedia';
import {
  getPublicAddress,
  getPublicEmail,
  getPublicHotlines
} from '@/features/site-shell/site-shell.public';
import { formatWorkingHours } from '@/lib/format/text';
import type { PublicCompanyInfo } from '@/types/contracts/public-site-shell';

type ContactInfoProps = {
  companyInfo: PublicCompanyInfo | null;
};

function getSafeMapSrc(embedCode: string | null | undefined) {
  if (!embedCode) {
    return null;
  }

  const trimmed = embedCode.trim();
  const match = trimmed.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
  const src = match?.[1] || trimmed;

  try {
    const parsed = new URL(src);
    if (
      parsed.origin !== 'https://www.google.com' ||
      parsed.pathname !== '/maps/embed'
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return src;
}

function normalizePhoneHref(value: string) {
  const normalized = value.replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : null;
}

function normalizeEmailHref(value: string) {
  const trimmed = value.trim();
  return trimmed.includes('@') ? `mailto:${trimmed}` : null;
}

export function ContactInfo({ companyInfo }: ContactInfoProps) {
  const workingHours = companyInfo
    ? formatWorkingHours(
        companyInfo.working_hours_from,
        companyInfo.working_hours_to,
        companyInfo.working_days
      )
    : null;
  const hotlines = getPublicHotlines(companyInfo);
  const email = getPublicEmail(companyInfo) || 'Đang cập nhật';
  const address = getPublicAddress(companyInfo) || 'Đang cập nhật';

  const items: Array<{
    label: string;
    values: Array<{ value: string; href: string | null }>;
    icon: ReactNode;
  }> = [
    {
      label: 'Hotline chăm sóc khách hàng',
      values:
        hotlines.length > 0
          ? hotlines.map((hotline) => ({
              value: hotline,
              href: normalizePhoneHref(hotline)
            }))
          : [{ value: 'Đang cập nhật', href: null }],
      icon: <PhoneIcon className="h-5 w-5" />
    },
    {
      label: 'Email',
      values: [{ value: email, href: normalizeEmailHref(email) }],
      icon: <MailIcon className="h-5 w-5" />
    },
    {
      label: 'Văn phòng',
      values: [{ value: address, href: null }],
      icon: <MapPinIcon className="h-5 w-5" />
    },
    {
      label: 'Giờ làm việc',
      values: [{ value: workingHours || 'Đang cập nhật', href: null }],
      icon: <ClockIcon className="h-5 w-5" />
    }
  ];

  return (
    <div className="w-full max-w-[calc(100vw-2rem)] rounded-sm border border-borderBlue bg-[oklch(0.995_0.004_248)] p-6 shadow-soft sm:p-8 lg:max-w-none lg:p-10">
      <h2 className="type-card-title-lg text-secondary">Thông tin liên hệ</h2>
      <p className="mt-3 text-[15px] leading-[1.6] text-body">
        Chọn kênh phù hợp hoặc gửi form, đội ngũ Song Thanh sẽ phản hồi theo thông tin bạn để lại.
      </p>
      <div className="mt-8 grid gap-5">
        {items.map(({ label, values, icon }) => (
          <div className="flex gap-4" key={label}>
            <span className="type-caption flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-primarySoft font-bold text-primaryStrong">
              {icon}
            </span>
            <div>
              <p className="type-body-sm font-medium text-slate-500">{label}</p>
              <div className="mt-1 grid gap-1">
                {values.map(({ value, href }) =>
                  href ? (
                    <a
                      className="type-body inline-flex min-h-8 items-center font-bold text-secondary transition-colors hover:text-primary"
                      href={href}
                      key={`${label}-${value}`}
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="type-body font-bold text-secondary" key={`${label}-${value}`}>
                      {value}
                    </p>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContactMapEmbed({ companyInfo }: ContactInfoProps) {
  const mapSrc = getSafeMapSrc(companyInfo?.map_embed_code);

  if (mapSrc) {
    return (
      <iframe
        className="h-[320px] w-full rounded-none border-0 sm:h-[420px] lg:h-[500px]"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapSrc}
        title="Bản đồ văn phòng Song Thanh"
      />
    );
  }

  return (
    <EmptyMedia
      caption="Bản đồ văn phòng sẽ được cập nhật."
      className="h-[320px] min-h-0 rounded-none border-0 sm:h-[420px] lg:h-[500px]"
      label="Khu vực bản đồ"
      variant="map"
    />
  );
}
