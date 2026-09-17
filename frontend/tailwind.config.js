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
        'float': 'float 5s ease-in-out infinite',
        'float-delayed': 'float 5s ease-in-out 1.5s infinite',
        // Subtle loading motion: a soft sweep across skeleton blocks, and a
        // slow breathe for the brand mark on the route-level loading screens.
        'shimmer': 'shimmer 1.9s ease-in-out infinite',
        'breathe': 'breathe 2.6s ease-in-out infinite',
        'loading-bar': 'loadingBar 1.5s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2.5s ease-in-out infinite',
        'float-slow': 'floatSlow 7s ease-in-out infinite',
        'shimmer-btn': 'shimmerBtn 2.5s ease-in-out infinite',
        // Visitor-pass QR sweep: a soft read line travelling down the code plate.
        'scan': 'scan 2.8s ease-in-out infinite',
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
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(0.94)', opacity: '0.75' },
        },
        loadingBar: {
          '0%': { transform: 'translateX(-100%)', width: '35%' },
          '50%': { width: '60%' },
          '100%': { transform: 'translateX(320%)', width: '35%' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(37,99,235,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(37,99,235,0.5)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translateY(0) translateX(0)' },
          '33%': { transform: 'translateY(-12px) translateX(4px)' },
          '66%': { transform: 'translateY(-6px) translateX(-4px)' },
        },
        shimmerBtn: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        scan: {
          '0%': { transform: 'translateY(-10%)', opacity: '0' },
          '15%, 85%': { opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
