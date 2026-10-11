/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        paper: 'var(--paper)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        'accent-ink': 'var(--accent-ink)',
        teal: 'var(--teal)',
        'teal-soft': 'var(--teal-soft)',
        'amber-soft': 'var(--amber-soft)',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { card: '20px' },
      boxShadow: { soft: '0 1px 2px rgba(60,40,20,.06), 0 8px 24px rgba(60,40,20,.08)' },
    },
  },
  plugins: [],
};
