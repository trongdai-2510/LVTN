import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-bg-page)',
        surface: 'var(--color-bg-surface)',
        subtle: 'var(--color-bg-subtle)',
        panel: 'var(--color-bg-panel)',
        footer: 'var(--color-bg-footer)',
        map: 'var(--color-bg-map)',
        text: 'var(--color-text-primary)',
        strong: 'var(--color-text-strong)',
        body: 'var(--color-text-body)',
        muted: 'var(--color-text-secondary)',
        border: 'var(--color-border-default)',
        borderBlue: 'var(--color-border-blue)',
        borderSoft: 'var(--color-border-soft)',
        primary: 'var(--color-brand-primary)',
        primaryStrong: 'var(--color-brand-primary-strong)',
        primarySoft: 'var(--color-brand-primary-soft)',
        secondary: 'var(--color-brand-secondary)',
        accent: 'var(--color-brand-accent)',
        success: 'var(--color-status-success)',
        error: 'var(--color-status-error)'
      },
      fontFamily: {
        sans: [
          'var(--font-body)',
          'Inter',
          'Be Vietnam Pro',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'sans-serif'
        ],
        display: [
          'var(--font-display)',
          'Manrope',
          'Inter',
          'system-ui',
          'sans-serif'
        ]
      },
      fontSize: {
        hero: ['var(--type-hero-title-size)', { lineHeight: 'var(--type-hero-title-line)', fontWeight: '800' }],
        page: ['var(--type-page-title-size)', { lineHeight: 'var(--type-page-title-line)', fontWeight: '800' }],
        section: ['var(--type-section-title-size)', { lineHeight: 'var(--type-section-title-line)', fontWeight: '700' }],
        body: ['var(--type-body-size)', { lineHeight: 'var(--type-body-line)', fontWeight: '400' }],
        caption: ['var(--type-caption-size)', { lineHeight: 'var(--type-caption-line)', fontWeight: '500' }]
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)'
      },
      boxShadow: {
        soft: 'var(--shadow-card)',
        action: 'var(--shadow-action)'
      },
      maxWidth: {
        container: 'var(--container-default)',
        wide: 'var(--container-wide)',
        narrow: 'var(--container-narrow)'
      }
    }
  },
  plugins: []
};

export default config;
