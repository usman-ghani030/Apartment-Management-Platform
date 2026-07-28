/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Display scale
        'display-lg': ['2.5rem', { lineHeight: '1.1', fontWeight: '800' }],
        'display': ['2rem', { lineHeight: '1.15', fontWeight: '800' }],
        'display-sm': ['1.5rem', { lineHeight: '1.2', fontWeight: '700' }],
        // Title scale
        'title': ['1.25rem', { lineHeight: '1.3', fontWeight: '700' }],
        'title-sm': ['1.125rem', { lineHeight: '1.35', fontWeight: '600' }],
        // Body scale
        'body': ['0.9375rem', { lineHeight: '1.5' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5' }],
        // Caption scale
        'caption': ['0.75rem', { lineHeight: '1.4' }],
        'caption-xs': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
      },
      colors: {
        // ── Single blue accent ──────────────────────────────────────────
        accent: {
          50: 'var(--color-accent-50)',
          100: 'var(--color-accent-100)',
          200: 'var(--color-accent-200)',
          300: 'var(--color-accent-300)',
          400: 'var(--color-accent-400)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
          700: 'var(--color-accent-700)',
          800: 'var(--color-accent-800)',
          900: 'var(--color-accent-900)',
        },
        // ── Warm neutral scale ──────────────────────────────────────────
        neutral: {
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },
        // ── Status colors ───────────────────────────────────────────────
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
          neutral: '#78716c',
        },
        // ── Surface tokens ──────────────────────────────────────────────
        surface: {
          DEFAULT: 'var(--color-surface)',
          raised: 'var(--color-surface-raised)',
          overlay: 'var(--color-surface-overlay)',
          accent: 'var(--color-surface-accent)',
        },
      },
      // ── Custom shadows ─────────────────────────────────────────────────
      boxShadow: {
        'card': '0 1px 2px 0 rgba(0,0,0,0.03), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.06)',
        'elevated': '0 8px 24px 0 rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'modal': '0 20px 60px 0 rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.06)',
        'button': '0 1px 2px 0 rgba(0,0,0,0.04)',
      },
      // ── Border radius scale ────────────────────────────────────────────
      borderRadius: {
        'sm': '0.375rem',
        'DEFAULT': '0.5rem',
        'md': '0.625rem',
        'lg': '0.75rem',
        'xl': '0.875rem',
        '2xl': '1rem',
      },
      // ── Spacing scale additions ────────────────────────────────────────
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '18': '4.5rem',
        '88': '22rem',
      },
      // ── Animations ────────────────────────────────────────────────────
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
