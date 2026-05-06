/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderWidth: {
        '1': '1px',
        '3': '3px',
        '6': '6px',
        '10': '10px',
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        destructive: 'var(--destructive)',
        muted: 'var(--muted)',
        surface: 'var(--surface)',
        line: 'var(--line)',
        ink: 'var(--ink)',
        sky: 'var(--confetti-sky)',
        lagoon: 'var(--confetti-lagoon)',
        lime: 'var(--confetti-lime)',
        'lime-bright': 'var(--confetti-lime-bright)',
        sun: 'var(--confetti-sun)',
        peach: 'var(--confetti-peach)',
        coral: 'var(--confetti-coral)',
        plum: 'var(--confetti-plum)',
        // 保留原有的自定义颜色配置 (兼容旧代码)
        'border-primary': 'var(--ink)',
        'border-secondary': 'var(--confetti-sky)',
        'border-accent': 'var(--confetti-sun)',
        'bg-primary': 'var(--muted)',
        'bg-secondary': 'var(--surface-strong)',
      },
    },
  },
  plugins: [],
  mode: "jit",
};
