import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 기본(primary): 딥 그린 — 신뢰감 있는 로컬 큐레이션 톤
        forest: {
          DEFAULT: "#234b3f",
          dark: "#193a30",
          soft: "#eaf1ee",
        },
        // 포인트(accent): 코랄/토마토 — 랭킹·레벨·반응 강조에만 제한적으로 사용
        coral: {
          DEFAULT: "#e0533f",
          dark: "#c5412e",
          soft: "#fbeee9",
        },
        // 잉크(텍스트/차콜)
        ink: {
          DEFAULT: "#1c2421",
          muted: "#5b6660",
        },
      },
    },
  },
  plugins: [],
};

export default config;
