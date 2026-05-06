import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "apps/**/.next/**",
    "apps/**/out/**",
    "apps/**/build/**",
    "apps/android-host/android/**",
    "apps/android-host/web-assets/**",
    "apps/android-host/nodejs-assets/nodejs-project/web/**",
    "apps/android-host/nodejs-assets/nodejs-project/node_modules/**",
    "packages/**/dist/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@next/next/no-img-element": "off",
      "@next/next/no-html-link-for-pages": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  }
]);

export default eslintConfig;
