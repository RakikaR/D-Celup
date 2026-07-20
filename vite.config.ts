// Konfigurasi Vite standar untuk TanStack Start (React) + Tailwind v4 + Nitro.
// Sebelumnya proyek ini memakai satu paket wrapper pihak ketiga yang
// membundel semua plugin di bawah ini secara implisit — plugin itu sudah
// dilepas dan diganti dengan pemasangan langsung lewat paket resmi
// masing-masing (semuanya sudah ada di package.json, tidak ada dependency
// baru).
//
// PENTING (urutan plugin):
//   - tanstackStart() harus dipasang SEBELUM viteReact().
//   - Jangan aktifkan `verbatimModuleSyntax` di tsconfig — bisa membuat
//     kode server bocor ke bundle client.
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    // Mencegah dua instance React/TanStack Router ke-bundle bersamaan
    // (penyebab umum error "Invalid hook call" di setup monorepo/symlink).
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
    // Alias eksplisit (selain plugin tsConfigPaths di bawah) — nitro
    // menjalankan server.ts di environment/worker sendiri yang tidak
    // selalu ikut ter-hook oleh plugin tsConfigPaths, jadi "@/*" perlu
    // di-resolve lewat opsi bawaan Vite ini juga supaya konsisten di
    // semua environment (client, ssr, maupun worker nitro).
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [
    tsConfigPaths(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    nitro(),
  ],
  environments: {
    ssr: {
      build: {
        // Arahkan build server Nitro ke server.ts (wrapper SSR error
        // handling kita), bukan entry bawaan TanStack Start.
        rollupOptions: { input: "./server.ts" },
      },
    },
  },
});

// CATATAN DEPLOYMENT: nitro() di atas belum diberi preset khusus, jadi
// akan pakai default Nitro (node-server) — cocok untuk hosting Node biasa.
// Kalau target deploy-nya platform tertentu (Cloudflare Workers, Vercel,
// dll), cek cara set preset di dokumentasi Nitro untuk versi yang dipakai
// di package.json ini (nitro@3 beta): https://nitro.build/deploy
