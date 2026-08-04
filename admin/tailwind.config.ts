import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        panel: 'var(--panel)',
        border: 'var(--border)',
        primary: 'var(--primary)',
        'primary-hover': 'var(--primary-hover)',
        'primary-foreground': 'var(--primary-foreground)',
        sidebar: 'var(--sidebar)',
        'sidebar-active': 'var(--sidebar-active)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        text: 'var(--text)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)'
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'monospace']
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)'
      },
      boxShadow: {
        soft: '0 12px 28px rgb(15 23 42 / 0.07)'
      }
    }
  },
  plugins: []
};

export default config;
