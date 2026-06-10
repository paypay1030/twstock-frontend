/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans TC', '-apple-system', 'BlinkMacSystemFont', 'PingFang TC', 'sans-serif'],
      },
      colors: {
        // 台股顏色系統
        'tw-up':   '#DC2626',
        'tw-down': '#16A34A',
        'tw-warn': '#EA580C',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
