/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Sans TC', '-apple-system', 'BlinkMacSystemFont', 'PingFang TC', 'sans-serif'],
      },
      colors: {
        /* 莫蘭迪奶茶色系 - 六層 */
        nb: {
          bg:      '#F5F0E8',   /* 頁面底色 */
          s0:      '#FBF7F2',   /* 主卡片 */
          s1:      '#F8F2E8',   /* 一般卡片 */
          s2:      '#F2E9DB',   /* AI / 今日筆記 */
          s3:      '#EDE0CF',   /* 提醒卡 */
          s4:      '#F0EAE0',   /* 技術分析卡 */
          s5:      '#EBE2D5',   /* 法人卡 / Footer */
          border:  '#E4D8C8',
          border2: '#D8CBBA',
          border3: '#CDBFAD',
          /* 文字層次 */
          t0: '#28211A',
          t1: '#5C4E42',
          t2: '#8C7E72',
          t3: '#B8A898',
          /* 功能色（莫蘭迪低飽和） */
          green:  '#5E9678',
          'green-bg': '#EAF2EC',
          orange: '#B87048',
          'orange-bg': '#F2E8DE',
          red:    '#A05858',
          'red-bg': '#F0E8E8',
          blue:   '#6880A0',
          'blue-bg': '#E8EDF5',
          yellow: '#A89050',
          'yellow-bg': '#F5EDD8',
          /* 台股漲跌（莫蘭迪版）*/
          up:   '#C05858',
          down: '#509070',
        },
        /* 保留既有 */
        'tw-up':   '#DC2626',
        'tw-down': '#16A34A',
        'tw-warn': '#EA580C',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
        '4xl': '1.5rem',
      },
      boxShadow: {
        'nb':    '0 1px 4px rgba(40,33,26,.07), 0 0 0 1px rgba(40,33,26,.03)',
        'nb-md': '0 4px 14px rgba(40,33,26,.10), 0 0 0 1px rgba(40,33,26,.03)',
        'nb-lg': '0 8px 24px rgba(40,33,26,.13), 0 0 0 1px rgba(40,33,26,.04)',
        'card':    '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-md': '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'fade-in': 'fadeIn .25s ease-out',
        'slide-up': 'slideUp .25s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
