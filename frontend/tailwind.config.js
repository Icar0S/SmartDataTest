/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // The landing look (login and home). Scoped by name, so the rest of the
      // app keeps its own palette and fonts.
      colors: {
        sdt: {
          bg: '#07060d',
          elevated: '#0e0b18',
          fg: '#f2effb',
          muted: '#928dab',
          'muted-strong': '#bdb8d3',
          violet: '#a78bfa',
          'violet-strong': '#c4b5fd',
          'violet-deep': '#7c3aed',
          fuchsia: '#e879f9',
          pink: '#f472b6',
          signal: '#67e8f9',
        },
      },
      fontFamily: {
        display: ['"Syne Variable"', 'Syne', 'system-ui', 'sans-serif'],
        body: ['"DM Sans Variable"', '"DM Sans"', 'system-ui', 'sans-serif'],
        code: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'float-slow': 'float 8s ease-in-out infinite',
        'float-slower': 'float 12s ease-in-out infinite',
        aurora: 'aurora-drift 18s ease-in-out infinite',
        floaty: 'floaty 7s ease-in-out infinite',
        'floaty-sm': 'floaty-sm 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
        marquee: 'marquee var(--marquee-duration, 40s) linear infinite',
        'gradient-pan': 'gradient-pan 6s linear infinite',
        'scroll-dot': 'scroll-dot 1.8s ease-in-out infinite',
        'fade-up': 'fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        scan: 'scan 3.2s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        caret: 'caret 1.1s steps(1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'aurora-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(4%, -3%) scale(1.1)' },
          '66%': { transform: 'translate(-3%, 4%) scale(0.95)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-18px)' },
        },
        'floaty-sm': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.75', transform: 'scale(1.05)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'gradient-pan': {
          '0%': { backgroundPosition: '0% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'scroll-dot': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '70%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '15%, 85%': { opacity: '1' },
          '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        caret: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
