import type { ReactNode } from 'react';

import {
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon
} from '@/components/ui/ContactIcons';
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
    <aside className="scroll-mt-28 lg:pt-1" id="thong-tin-lien-he">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Liên hệ trực tiếp</p>
      <h2 className="mt-3 font-display text-3xl font-semibold leading-tight text-secondary">Thông tin liên hệ</h2>
      <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-body">Chọn kênh phù hợp với nhu cầu của bạn.</p>
      <div className="mt-8">
        {items.map(({ label, values, icon }) => (
          <div className="flex gap-4 border-t border-borderBlue py-5" key={label}>
            <span aria-hidden="true" className="mt-0.5 shrink-0 text-primary">
              {icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{label}</p>
              <div className="mt-2 grid gap-1">
                {values.map(({ value, href }) =>
                  href ? (
                    <a
                      className="inline-flex min-h-8 max-w-full items-center break-all text-[15px] font-semibold leading-relaxed text-secondary transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      href={href}
                      key={`${label}-${value}`}
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="break-words text-[15px] font-semibold leading-relaxed text-secondary" key={`${label}-${value}`}>
                      {value}
                    </p>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function ContactMapEmbed({ companyInfo }: ContactInfoProps) {
  const mapSrc = getSafeMapSrc(companyInfo?.map_embed_code);
  const address = getPublicAddress(companyInfo);

  if (mapSrc) {
    return (
      <iframe
        className="block h-[340px] w-full border-0 sm:h-[400px]"
        loading="eager"
        referrerPolicy="no-referrer-when-downgrade"
        src={mapSrc}
        title="Bản đồ văn phòng Song Thanh"
      />
    );
  }

  return (
    <div className="flex min-h-[250px] items-center bg-primarySoft/40 p-7">
      <div>
        <MapPinIcon className="h-7 w-7 text-primary" />
        <p className="mt-5 font-display text-xl font-semibold text-secondary">Bản đồ văn phòng đang được cập nhật</p>
        <p className="mt-2 text-sm leading-relaxed text-body">{address ? 'Bạn có thể dùng địa chỉ và liên kết Google Maps ở bên cạnh để tìm đường.' : 'Vui lòng dùng thông tin liên hệ ở trên để trao đổi với Song Thanh.'}</p>
      </div>
    </div>
  );
}
