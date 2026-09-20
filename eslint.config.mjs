import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      "dist/**",
      ".next/**",
      "node_modules/**",
      "public/data/**",
      "scripts/**",
      "supabase/**",
      "vendor/**",
    ],
  },
];

export default config;
