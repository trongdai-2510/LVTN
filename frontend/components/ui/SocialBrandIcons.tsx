import type { ComponentType, SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { size?: number | string };

function baseProps({ size, ...rest }: Props) {
  return {
    width: size ?? 20,
    height: size ?? 20,
    ...rest
  };
}

export function FacebookBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 16 16" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M14 0H2C.897 0 0 .897 0 2v12c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2V2c0-1.103-.897-2-2-2z" fill="#1976D2" />
      <path clipRule="evenodd" d="M13.5 8H11V6c0-.552.448-.5 1-.5h1V3h-2a3 3 0 0 0-3 3v2H6v2.5h2V16h3v-5.5h1.5l1-2.5z" fill="#f8fafc" fillRule="evenodd" />
    </svg>
  );
}

export function MessengerBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 24 24" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M12 2C6.48 2 2 6.15 2 11.27c0 2.92 1.46 5.52 3.74 7.22V22l3.42-1.88c.92.25 1.9.39 2.94.39 5.52 0 10-4.15 10-9.27C22.1 6.15 17.52 2 12 2z" fill="#0A7CFF" />
      <path d="m6.9 13.84 2.93-4.65 3.04 3.22 2.76-3.22-2.93 4.65-3.04-3.22-2.76 3.22z" fill="#f8fafc" />
    </svg>
  );
}

export function InstagramBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 16 16" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id="song-thanh-ig-a" x1="1.464" x2="14.536" y1="14.536" y2="1.464">
          <stop offset="0" stopColor="#FFC107" />
          <stop offset=".507" stopColor="#F44336" />
          <stop offset=".99" stopColor="#9C27B0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id="song-thanh-ig-b" x1="5.172" x2="10.828" y1="10.828" y2="5.172">
          <stop offset="0" stopColor="#FFC107" />
          <stop offset=".507" stopColor="#F44336" />
          <stop offset=".99" stopColor="#9C27B0" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id="song-thanh-ig-c" x1="11.923" x2="12.677" y1="4.077" y2="3.323">
          <stop offset="0" stopColor="#FFC107" />
          <stop offset=".507" stopColor="#F44336" />
          <stop offset=".99" stopColor="#9C27B0" />
        </linearGradient>
      </defs>
      <path d="M11 0H5a5 5 0 0 0-5 5v6a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5V5a5 5 0 0 0-5-5zm3.5 11c0 1.93-1.57 3.5-3.5 3.5H5c-1.93 0-3.5-1.57-3.5-3.5V5c0-1.93 1.57-3.5 3.5-3.5h6c1.93 0 3.5 1.57 3.5 3.5v6z" fill="url(#song-thanh-ig-a)" />
      <path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 6.5A2.503 2.503 0 0 1 5.5 8c0-1.379 1.122-2.5 2.5-2.5s2.5 1.121 2.5 2.5c0 1.378-1.122 2.5-2.5 2.5z" fill="url(#song-thanh-ig-b)" />
      <circle cx="12.3" cy="3.7" fill="url(#song-thanh-ig-c)" r=".533" />
    </svg>
  );
}

export function WhatsappBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 24 24" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path clipRule="evenodd" d="M20.463 3.488C18.217 1.24 15.231.001 12.05 0 5.495 0 .16 5.334.157 11.892c-.001 2.096.547 4.142 1.588 5.946L.057 24l6.304-1.654c1.737.948 3.693 1.447 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893.001-3.177-1.235-6.166-3.479-8.413zM12.05 21.785h-.004c-1.774 0-3.513-.477-5.031-1.378l-.361-.214-3.741.981.999-3.648-.235-.374c-.99-1.574-1.512-3.393-1.511-5.26.002-5.45 4.437-9.884 9.889-9.884 2.64 0 5.122 1.03 6.988 2.898 1.866 1.869 2.893 4.352 2.892 6.993-.003 5.45-4.437 9.886-9.885 9.886zm5.422-7.403c-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.148s-.767.967-.941 1.166c-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.241-.58-.486-.501-.669-.51-.173-.009-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.298-1.04 1.017-1.04 2.479 0 1.463 1.065 2.876 1.213 3.074.148.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.075-.124-.273-.198-.57-.347z" fill="#25D366" fillRule="evenodd" />
    </svg>
  );
}

export function YoutubeBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 24 24" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="#FF0000" />
      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#f8fafc" />
    </svg>
  );
}

export function LinkedinBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 24 24" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.063 2.063 0 1 1 2.063 2.065zm1.778 13.019H3.555V9h3.56v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2" />
    </svg>
  );
}

export function TiktokBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 24 24" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M9.5 8.6v2.2c-.7-.1-1.4 0-2.1.2-1 .3-1.9 1-2.4 1.9-.5.9-.6 2-.3 3a4 4 0 0 0 1.9 2.4l-.1.1c-1.3-.1-2.5-.7-3.4-1.7a4.4 4.4 0 0 1-1-3.7c.2-1.3.9-2.5 2-3.3a4.7 4.7 0 0 1 3.7-1c.5.1 1.1.2 1.7.4Z" fill="#25F4EE" />
      <path d="M16.6 2v.6c0 1.2.5 2.3 1.3 3.1.8.8 2 1.3 3.1 1.3v3.2c-1.7 0-3.3-.5-4.7-1.4v6.4c0 1.3-.4 2.5-1.1 3.6a6.5 6.5 0 0 1-5.7 2.8 6.5 6.5 0 0 1-3.4-1c-1-.6-1.8-1.5-2.3-2.6a6.5 6.5 0 0 1 1.4-7.4 6.5 6.5 0 0 1 4.3-1.8c.4 0 .8 0 1.2.1v3.3c-.4-.1-.8-.2-1.2-.2-.9 0-1.7.3-2.3.9a3.3 3.3 0 0 0 0 4.7c.6.6 1.5.9 2.3.9.9 0 1.7-.3 2.3-.9.6-.6.9-1.5.9-2.3V2h3.9Z" fill="#111827" />
      <path d="M21 6.4v3.2c-1.7 0-3.3-.5-4.7-1.4v6.4c0 1.3-.4 2.5-1.1 3.6a6.5 6.5 0 0 1-5.7 2.8 6.5 6.5 0 0 1-3.4-1c.8.4 1.6.6 2.5.6 1.3 0 2.5-.4 3.5-1.2 1-.7 1.8-1.8 2.2-3 .3-.7.4-1.5.4-2.3V8.1c1.4.9 3 1.4 4.7 1.4V6.4c.5.1 1 .1 1.6 0Z" fill="#FE2C55" />
    </svg>
  );
}

export function ZaloBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="174 174 420 420" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <image
        height="768"
        href="/assets/social/zalo-logo.png"
        preserveAspectRatio="xMidYMid meet"
        width="768"
      />
    </svg>
  );
}

export function TwitterXBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 24 24" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#111827" />
    </svg>
  );
}

export function TelegramBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 24 24" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="#229ED9" />
      <path d="M5.491 11.74c3.5-1.524 5.833-2.529 7-3.014 3.334-1.387 4.027-1.628 4.479-1.636.099-.002.321.023.464.14a.5.5 0 0 1 .171.323c.016.093.036.305.02.47-.183 1.926-.977 6.598-1.38 8.755-.171.913-.508 1.219-.835 1.249-.71.066-1.25-.469-1.939-.92-1.077-.706-1.685-1.146-2.731-1.835-1.21-.797-.425-1.235.264-1.95.18-.187 3.31-3.034 3.371-3.293.008-.032.015-.153-.057-.217-.072-.064-.178-.042-.255-.025-.108.025-1.83 1.163-5.166 3.415-.488.336-.93.5-1.327.49-.437-.009-1.276-.246-1.901-.448-.766-.249-1.376-.38-1.322-.803.027-.221.331-.446.91-.677z" fill="#f8fafc" />
    </svg>
  );
}

export function WebsiteGlobeBrand(props: Props) {
  const { width, height, ...rest } = baseProps(props);

  return (
    <svg height={height} viewBox="0 0 24 24" width={width} xmlns="http://www.w3.org/2000/svg" {...rest}>
      <circle cx="12" cy="12" fill="#475569" r="10" />
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.929 6h-2.948c-.32-1.39-.79-2.6-1.38-3.516A8.03 8.03 0 0 1 18.93 8ZM12 4c.97 0 2.192 1.484 2.84 4h-5.68C9.808 5.484 11.03 4 12 4ZM4 12c0-.7.1-1.36.281-2H8c-.066.65-.094 1.32-.094 2 0 .68.028 1.35.094 2H4.281A8.04 8.04 0 0 1 4 12Zm1.07 4h2.95c.32 1.39.79 2.6 1.38 3.516A8.03 8.03 0 0 1 5.07 16Zm2.95-8H5.07a8.03 8.03 0 0 1 4.33-3.516C8.808 5.4 8.338 6.61 8.02 8Zm3.98 12c-.97 0-2.192-1.484-2.84-4h5.68c-.648 2.516-1.87 4-2.84 4Zm3.157-6h-6.314c-.078-.65-.115-1.32-.115-2 0-.68.037-1.35.115-2h6.314c.078.65.115 1.32.115 2 0 .68-.037 1.35-.115 2Zm.493 5.516c.59-.917 1.06-2.127 1.38-3.516h2.95a8.03 8.03 0 0 1-4.33 3.516ZM16 12c0-.68-.028-1.35-.094-2h3.813c.181.64.281 1.3.281 2s-.1 1.36-.281 2H15.906c.066-.65.094-1.32.094-2Z" fill="#f8fafc" />
    </svg>
  );
}

const SOCIAL_BRAND_ICONS: Record<string, ComponentType<Props>> = {
  facebook: FacebookBrand,
  messenger: MessengerBrand,
  instagram: InstagramBrand,
  whatsapp: WhatsappBrand,
  youtube: YoutubeBrand,
  linkedin: LinkedinBrand,
  tiktok: TiktokBrand,
  zalo: ZaloBrand,
  twitter: TwitterXBrand,
  x: TwitterXBrand,
  telegram: TelegramBrand,
  website: WebsiteGlobeBrand
};

export function getSocialBrandIcon(platform: string) {
  return SOCIAL_BRAND_ICONS[platform.toLowerCase()] ?? WebsiteGlobeBrand;
}

export function SocialBrandIcon({ platform, ...props }: Props & { platform: string }) {
  const Icon = getSocialBrandIcon(platform);

  return <Icon {...props} />;
}
