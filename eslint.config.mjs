import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // dev-only scripts walk untyped JSON API responses; `any` is acceptable there, never in app code
  { files: ["scripts/**"], rules: { "@typescript-eslint/no-explicit-any": "off" } },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-*/**", // any extra build dir (NEXT_DIST_DIR=…) — e2e/test servers, local prod builds
    "playwright-report/**",
    "test-results/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
