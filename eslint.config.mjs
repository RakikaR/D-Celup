// Konfigurasi ESLint untuk TanStack Start (React) + TypeScript.
//
// CATATAN: config sebelumnya adalah sisa boilerplate dari template
// Next.js (mengimpor "eslint-config-next"), padahal project ini
// memakai TanStack Start — paket itu bahkan tidak ada di
// package.json, sehingga `npm run lint` langsung gagal dengan error
// "module not found". Config di bawah dibangun dari paket yang memang
// sudah terpasang di devDependencies.
import js from "@eslint/js";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  globalIgnores([
    "dist/**",
    "build/**",
    ".output/**",
    ".nitro/**",
    "node_modules/**",
    "src/routeTree.gen.ts",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Matikan rule ESLint yang bentrok dengan Prettier — biarkan Prettier
  // yang mengurus formatting, ESLint fokus ke kualitas kode.
  prettier,
]);

export default eslintConfig;
