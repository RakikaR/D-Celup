# Arsitektur — D'Celup Fried Chicken

Dokumen ini menjelaskan struktur direktori dan arsitektur sistem manajemen
stok & penjualan multi-outlet D'Celup Fried Chicken secara menyeluruh:
front-end, back-end/logika bisnis, dan database.

## Daftar Isi

1. [Tech Stack](#1-tech-stack--fondasi-project)
2. [Peta Direktori](#2-peta-direktori-lengkap)
3. [Arsitektur Front-end](#3-arsitektur-front-end-antarmuka)
4. [Arsitektur Back-end](#4-arsitektur-back-end-logika-bisnis--api)
5. [Arsitektur Database](#5-arsitektur-database-supabase--postgres)
6. [Alur Data End-to-End](#6-alur-data-end-to-end-contoh-nyata)
7. [Ringkasan Karakter Arsitektur](#7-ringkasan-karakter-arsitektur)

---

## 1. Tech Stack — Fondasi Project

| Layer | Teknologi | Fungsi |
|---|---|---|
| Framework | **TanStack Start** (`@tanstack/react-start`) | Full-stack React framework — routing, SSR, dan server functions dalam satu framework |
| Routing | **TanStack Router** (file-based) | Routing berbasis nama file, type-safe |
| UI Library | **React 19** | Rendering komponen |
| Styling | **Tailwind CSS v4** + **shadcn/ui** ("new-york" style) | Utility-first CSS + komponen UI siap pakai berbasis Radix |
| State server | **TanStack Query** (`@tanstack/react-query`) | Disediakan di context router, meski penggunaannya di route saat ini masih manual `useState`/`useEffect` (lihat catatan §3.5) |
| Database & Auth | **Supabase** (Postgres + Supabase Auth) | Database, autentikasi, dan storage |
| Validasi | **Zod** | Validasi input di setiap server function |
| PDF | **@react-pdf/renderer** | Generate laporan PDF di sisi client |
| Charts | **Recharts** | Grafik omset di dashboard |
| Build tool | **Vite 7** + **Nitro 3** (beta) | Bundling client & server, output ke Node server |
| Package manager | **Bun** (`bunfig.toml`) | — |
| Bahasa | TypeScript (strict mode aktif) | — |

Arsitektur besarnya: **1 aplikasi monolitik** — frontend React dan backend
("server functions") hidup dalam satu codebase yang sama, dikompilasi jadi
1 bundle client + 1 bundle server oleh Vite/Nitro. Tidak ada REST API
terpisah — komunikasi client↔server terjadi lewat **RPC ala function
call** (`createServerFn`), bukan lewat endpoint URL manual.

---

## 2. Peta Direktori Lengkap

```
D-Celup-Fried-Chicken/
├── .env.example              ← contoh env var yang dibutuhkan
├── .gitignore
├── .prettierrc                ← format code (printWidth 100, double-quote off, dst.)
├── .prettierignore
├── bunfig.toml                ← config Bun: minimumReleaseAge 24 jam (supply-chain guard)
├── components.json            ← config shadcn/ui
├── eslint.config.mjs          ← aturan lint (TypeScript + React Hooks)
├── package.json               ← daftar dependency & script
├── postcss.config.mjs         ← plugin PostCSS untuk Tailwind v4
├── public/
│   └── favicon.svg            ← ikon tab browser
├── README.md
├── server.ts                  ← entrypoint HTTP request ke Nitro/TanStack Start (§4.5)
├── start.ts                   ← konfigurasi global TanStack Start (middleware request-level)
├── tsconfig.json               ← config compiler TypeScript
├── vite.config.ts             ← config bundler: plugin, alias, dedupe
└── src/
    ├── styles.css              ← seluruh design token (warna, radius, font) + Tailwind v4 @theme
    ├── router.tsx              ← factory pembuat instance router (dipakai server.ts & entry client)
    ├── routeTree.gen.ts        ← FILE AUTO-GENERATED oleh plugin router, JANGAN diedit manual
    ├── components/
    │   ├── UI/                 ← 46 komponen primitif shadcn/ui (button, dialog, table, dst.)
    │   ├── layout/
    │   │   └── AppShell.tsx    ← kerangka sidebar + header, dipakai di semua halaman /app/*
    │   ├── dashboard/
    │   │   ├── SummaryCards.tsx
    │   │   └── SalesChart.tsx
    │   ├── forms/
    │   │   ├── SalesForm.tsx
    │   │   └── InventoryForm.tsx
    │   └── reports/
    │       └── ReportPDF.tsx   ← definisi dokumen PDF (bukan komponen HTML biasa)
    ├── hooks/
    │   ├── use-auth.tsx        ← Context Provider auth (React Context + Supabase client browser)
    │   └── use-mobile.tsx      ← hook deteksi lebar layar (dipakai shadcn sidebar/sheet)
    ├── lib/
    │   ├── utils.ts            ← helper `cn()` untuk merge className Tailwind
    │   ├── error-capture.ts    ← tangkap error global sisi server (window/global listener)
    │   ├── error-reporting.ts  ← titik tunggal log error dari React Error Boundary
    │   ├── error-page.ts       ← HTML fallback statis untuk error fatal SSR
    │   ├── config.server.ts    ← baca env var server-only
    │   ├── auth/
    │   │   └── auth.middleware.ts   ← JANTUNG keamanan backend (§4.2)
    │   ├── data/
    │   │   └── types.ts        ← tipe domain (Role, Outlet, Product, dst.) dipakai FE & BE
    │   ├── db/
    │   │   ├── supabase.server.ts   ← factory Supabase client pakai service_role key
    │   │   └── types.db.ts     ← tipe hasil generate dari schema Supabase (§5)
    │   └── api/                ← SEMUA "endpoint" backend ada di sini, sebagai fungsi
    │       ├── auth.functions.ts
    │       ├── outlets.functions.ts
    │       ├── inventory.functions.ts
    │       ├── sales.functions.ts
    │       └── dashboard.functions.ts
    └── routes/                 ← file-based routing (nama file = path URL)
        ├── __root.tsx          ← root layout: <html>, meta tag, error/404 boundary
        ├── index.tsx           ← "/" — router murni, redirect sesuai status login
        ├── auth.tsx             ← "/auth" — halaman login
        ├── register.tsx        ← "/register" — halaman aktivasi akun (whitelist-based)
        ├── sitemap[.]xml.ts    ← "/sitemap.xml" — endpoint HTTP biasa (bukan halaman React)
        ├── app.tsx              ← "/app" — guard: harus login, kalau tidak → redirect /auth
        ├── app.hq.tsx           ← "/app/hq" — guard tambahan: harus role hq_admin
        ├── app.hq.index.tsx    ← "/app/hq/" — dashboard HQ (grafik + ringkasan semua outlet)
        ├── app.hq.products.tsx ← "/app/hq/products" — CRUD master produk
        ├── app.hq.reports.tsx  ← "/app/hq/reports" — filter laporan + export PDF/WhatsApp
        ├── app.hq.outlets.$outletId.tsx  ← "/app/hq/outlets/:outletId" — detail 1 outlet
        ├── app.outlet.index.tsx    ← "/app/outlet/" — dashboard staff outlet
        ├── app.outlet.sales.tsx    ← "/app/outlet/sales" — input penjualan harian
        ├── app.outlet.inventory.tsx← "/app/outlet/inventory" — input stok opname harian
        └── app.outlet.history.tsx ← "/app/outlet/history" — riwayat 30 hari
```

Konvensi penamaan **TanStack Router file-based**: titik (`.`) di nama file
= pemisah segmen URL. Jadi `app.hq.outlets.$outletId.tsx` →
`/app/hq/outlets/:outletId`, dan `$outletId` adalah dynamic segment
(parameter URL). File `app.hq.index.tsx` dan `app.outlet.index.tsx`
memetakan ke path dengan trailing slash (`/app/hq/`, `/app/outlet/`) —
itu konvensi "index route" di dalam suatu segmen.

---

## 3. Arsitektur Front-end (Antarmuka)

### 3.1. Alur Routing & Proteksi Halaman (3 Lapis Guard)

Aplikasi punya **3 lapis nested layout/guard** yang bertingkat, semuanya
murni untuk UX (sembunyikan menu) — bukan keamanan sungguhan (keamanan
sungguhan ada di backend, lihat §4):

```
__root.tsx  (root layout — <html>, <Toaster>, AuthProvider, AuthGate)
 └─ app.tsx  (guard: "harus sudah login" — kalau belum, redirect ke /auth)
     ├─ app.hq.tsx  (guard: "harus role hq_admin" — kalau bukan, redirect ke /app/outlet)
     │   ├─ app.hq.index.tsx           → Dashboard HQ
     │   ├─ app.hq.products.tsx        → Master Produk
     │   ├─ app.hq.reports.tsx         → Laporan & Export
     │   └─ app.hq.outlets.$outletId.tsx → Detail Outlet
     └─ (app.outlet.* tidak punya file guard eksplisit "app.outlet.tsx",
         proteksi role outlet_staff cukup di level app.tsx + AppShell yang
         menampilkan menu sesuai role dari useAuth())
         ├─ app.outlet.index.tsx    → Dashboard Outlet
         ├─ app.outlet.sales.tsx    → Input Penjualan
         ├─ app.outlet.inventory.tsx → Stok Opname
         └─ app.outlet.history.tsx  → Riwayat 30 Hari
```

**`__root.tsx`** adalah lapisan paling luar. Isinya:
- `head()` — mendefinisikan semua meta tag (title, description, Open
  Graph, favicon) dan link stylesheet.
- `RootShell` — komponen yang render `<html lang="id">`, `<HeadContent/>`
  (inject meta dari TanStack Router), dan `<Scripts/>` (inject JS bundle).
- `RootComponent` — membungkus seluruh app dengan `QueryClientProvider`
  (TanStack Query) → `AuthProvider` (context auth Supabase) → `AuthGate`
  (tunda render sampai status login diketahui) → `<Outlet/>` (tempat
  child route dirender) → `<Toaster/>` (notifikasi toast dari `sonner`).
- `notFoundComponent` dan `errorComponent` — fallback UI untuk 404 dan
  error React, dalam Bahasa Indonesia.

**`index.tsx`** ("/") — halaman ini **tidak menampilkan apa pun**,
fungsinya cuma jadi "router traffic cop": cek status login lewat
`useAuth()`, lalu redirect ke `/app/hq` (kalau `hq_admin`) atau
`/app/outlet` (kalau `outlet_staff`), atau ke `/auth` kalau belum login.

**`app.tsx`** — guard pertama: kalau `useAuth()` bilang belum login,
redirect ke `/auth`. Selama status auth masih `isLoading`, tampilkan
spinner. Setelah lolos, render `<AppShell/>` yang berisi sidebar +
`<Outlet/>` untuk semua halaman `/app/*`.

**`app.hq.tsx`** — guard kedua, khusus cabang `/app/hq/*`: kalau user
login tapi bukan `hq_admin`, dilempar ke `/app/outlet`.

### 3.2. State Management: Auth Context (`use-auth.tsx`)

Ini bukan Redux/Zustand — polanya **React Context sederhana** yang
membungkus Supabase Auth:

1. Membuat 1 instance `supabase` client browser (pakai
   `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` — anon key aman
   diekspos ke browser).
2. `AuthProvider` subscribe ke `supabase.auth.onAuthStateChange()` —
   setiap kali sesi berubah (login/logout/refresh token), otomatis
   `loadUserProfile()` dipanggil untuk mengambil `nama`, `outlet_id`
   (dari tabel `profiles`), dan `role` (dari tabel `user_roles`), lalu
   disimpan di state `user`.
3. Context mengekspos: `user`, `login()`, `logout()`, `isAdmin`,
   `isStaff`, `currentOutletId`, `isLoading`.
4. Semua halaman yang butuh tahu "siapa saya" tinggal panggil
   `const { user, isAdmin, currentOutletId } = useAuth()`.

**Penting**: token JWT Supabase disimpan otomatis oleh SDK Supabase
sendiri (bukan manual di `localStorage` oleh kode aplikasi).

### 3.3. Komponen — 4 Kategori

- **`components/UI/`** — 46 file, komponen **primitif shadcn/ui**
  (Button, Dialog, Table, Select, Sheet, dst.), dibangun di atas Radix UI
  primitives + `class-variance-authority` untuk varian style.
  Konfigurasinya ada di **`components.json`** (style "new-york", base
  color "slate", tanpa prefix class Tailwind).
- **`components/layout/AppShell.tsx`** — kerangka utama tiap halaman
  `/app/*`: sidebar kiri (desktop, `md:flex`) berisi menu navigasi yang
  **berbeda isi tergantung role** (`isAdmin` → menu Owner: Dashboard/
  Master Produk/Laporan/daftar outlet cabang; `isStaff` → menu Staff:
  Dashboard/Stok Opname/Input Penjualan/Riwayat), header mobile dengan
  hamburger menu (`Sheet` dari shadcn) untuk layar sempit, dan area
  konten `<Outlet/>` di kanan.
- **`components/dashboard/`** — `SummaryCards.tsx` (4 kartu ringkasan
  angka: omset hari ini, omset bulan ini, porsi terjual, outlet aktif)
  dan `SalesChart.tsx` (grafik garis Recharts, 1 garis per outlet, 7 hari
  terakhir).
- **`components/forms/`** — `SalesForm.tsx` (form tambah baris produk
  terjual + qty, hitung subtotal & total otomatis) dan
  `InventoryForm.tsx` (tabel editable stok bahan baku: stok awal/masuk/
  akhir → `terpakai` dihitung otomatis `awal + masuk - akhir`).
- **`components/reports/ReportPDF.tsx`** — bukan komponen HTML, ini
  **dokumen PDF** yang dibangun pakai primitif dari
  `@react-pdf/renderer` (`<Document>`, `<Page>`, `<View>`, `<Text>`
  dengan `StyleSheet.create` mirip React Native). Di-generate murni di
  **sisi browser** (client-side) via `pdf(doc).toBlob()`, lalu
  di-download — tidak ada proses generate PDF di server.

### 3.4. Styling & Theming (`styles.css`)

Pakai Tailwind v4 dengan pendekatan `@theme inline` — semua warna
didefinisikan sebagai CSS custom property dalam format **OKLCH** (bukan
hex/RGB), lalu dipetakan ke nama semantik (`--color-primary`,
`--color-muted`, dst.) yang dipakai komponen shadcn. Ada juga warna brand
khusus: `--color-brand-red`, `--color-brand-gold`, `--color-brand-orange`,
`--color-brand-cream`, `--color-brand-dark` — dipakai di elemen custom
seperti sidebar aktif dan tombol utama. Mendukung **dark mode** lewat
class `.dark` (`@custom-variant dark (&:is(.dark *))`), meski belum ada
toggle UI untuk mengaktifkannya.

### 3.5. Catatan Arsitektur Front-end

- **Tidak ada penggunaan TanStack Query untuk data fetching** meskipun
  sudah disediakan di context (`QueryClientProvider`). Semua halaman
  fetch data manual pakai kombinasi `useState` + `useEffect` +
  `.then()/.catch()/.finally()`. Ini bekerja, tapi berarti tidak ada
  caching/refetch otomatis/optimistic update yang biasanya jadi alasan
  orang pakai React Query.
- Ada 1 nilai hardcoded yang perlu dicek: di `SummaryCards.tsx` teks
  "Total 3 outlet" ditulis statis, tidak dihitung dari `outletAktif`
  yang sebenarnya ada di props.

---

## 4. Arsitektur Back-end (Logika Bisnis / "API")

### 4.1. Konsep Kunci: `createServerFn` (RPC, bukan REST)

TanStack Start punya API bernama `createServerFn` — fungsi yang
**ditulis sekali** tapi berjalan di server, dan otomatis di-generate
jadi HTTP endpoint yang bisa dipanggil dari kode client seolah-olah
manggil fungsi biasa:

```ts
// definisi di server (src/lib/api/sales.functions.ts)
export const getSales = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ outlet_id: z.string().optional(), ... }))
  .handler(async ({ data, context }) => { /* ...query ke Supabase... */ });

// pemanggilan di client (src/routes/app.hq.outlets.$outletId.tsx)
const sales = await getSales({ data: { outlet_id: "..." } });
```

Di balik layar, Vite membundel handler ini agar **hanya jalan di
server** — kode di dalamnya (yang menyentuh `getSupabaseAdmin()`,
service_role key, dst.) tidak pernah dikirim ke browser. Yang sampai ke
client hanyalah "stub" pemanggil HTTP.

Semua "endpoint" ada di **`src/lib/api/*.functions.ts`**, dikelompokkan
per domain:

| File | Endpoint | Middleware | Fungsi |
|---|---|---|---|
| `auth.functions.ts` | `registerUser` | tanpa middleware (memang belum ada sesi) | Aktivasi akun baru, tapi hanya untuk email yang sudah di-whitelist di tabel `allowed_emails` |
| `outlets.functions.ts` | `getOutlets`, `getProducts` | `authMiddleware` | Baca data — semua role login boleh akses |
| `outlets.functions.ts` | `createOutlet`, `upsertProduct`, `deactivateProduct` | `requireRole("hq_admin")` | Tulis — hanya HQ admin |
| `inventory.functions.ts` | `getInventory`, `getInventoryHistory`, `upsertInventory`, `deleteInventoryItem` | `authMiddleware` + `assertOwnOutlet()` manual di handler | Staff hanya bisa akses outlet miliknya sendiri |
| `sales.functions.ts` | `getSales`, `getSalesByDate`, `upsertSales` | `authMiddleware` + `assertOwnOutlet()`/`resolveReadableOutletId()` | Sama pola dengan inventory |
| `dashboard.functions.ts` | `getDashboardSummary` | `requireRole("hq_admin")` | Agregasi omset semua outlet — khusus HQ |

### 4.2. Lapisan Keamanan — `auth.middleware.ts` (Bagian Paling Penting)

Ini bukan sekadar "pemanis", tapi **satu-satunya lapisan yang benar-benar
menjaga data**. Alasannya: guard di level route React (`app.tsx`,
`app.hq.tsx`) hanya menyembunyikan *tampilan* di browser — tapi setiap
`createServerFn` tetap jadi endpoint HTTP publik yang bisa dipanggil
langsung lewat `curl`/`fetch`, terlepas dari UI-nya. Jadi validasi harus
terjadi di server, bukan di client.

Alurnya (`authMiddleware`):

1. **`.client()`** — ambil `access_token` dari sesi Supabase aktif di
   browser, kirim ke server lewat mekanisme resmi `sendContext`
   TanStack Start (bukan header manual buatan sendiri).
2. **`.server()`** — verifikasi ulang token itu langsung ke Supabase Auth
   (`supabase.auth.getUser(token)`) — **tidak pernah percaya isi token
   dari client secara mentah**, hanya dipakai sebagai kunci untuk
   mengambil identitas asli dari sumber tepercaya.
3. Ambil `profile` (nama, outlet_id) dan `user_roles` (role) dari
   database berdasarkan `userId` yang sudah diverifikasi.
4. Taruh hasilnya di `context.auth: AuthUser` — satu-satunya sumber
   identitas yang boleh dipakai handler untuk keputusan otorisasi
   (bukan `outlet_id` yang dikirim client lewat body request).

Dua helper turunannya:

- **`requireRole(...roles)`** — middleware factory, otomatis reject
  dengan HTTP 403 kalau `context.auth.role` tidak ada di daftar role
  yang diizinkan.
- **`assertOwnOutlet(auth, outletId)`** — dipanggil manual di dalam
  handler (bukan middleware) untuk memastikan `outlet_staff` cuma bisa
  baca/tulis data outlet miliknya sendiri; `hq_admin` selalu lolos.

### 4.3. Validasi Input — Zod di Setiap Endpoint

Setiap `createServerFn` yang menerima data punya
`.inputValidator(zodSchema)`. Contoh pola yang berulang: tanggal
divalidasi dengan regex `/^\d{4}-\d{2}-\d{2}$/` (format `YYYY-MM-DD`),
angka divalidasi `.min(0)` supaya tidak ada nilai negatif nyasar ke
database.

### 4.4. Registrasi Akun — Model "Whitelist by Admin"

`registerUser` di `auth.functions.ts` sengaja **tidak** pakai
`authMiddleware` (karena dipanggil sebelum user punya sesi). Keamanannya
bertumpu pada tabel `allowed_emails` yang hanya bisa diisi admin langsung
lewat Supabase dashboard. Alurnya:

1. Cek apakah email ada di `allowed_emails` → kalau tidak, tolak.
2. Buat user di Supabase Auth (`supabase.auth.admin.createUser`).
3. Update `profiles` dengan `outlet_id` **dari tabel `allowed_emails`**
   (bukan dari input user — supaya tidak bisa dipalsukan).
4. Insert `user_roles` dengan `role` juga dari `allowed_emails`.
5. Hapus baris `allowed_emails` itu supaya tidak bisa dipakai daftar
   ulang.

### 4.5. Error Handling — 3 Lapis Pertahanan

1. **`start.ts`** — `errorMiddleware` global (jalan di setiap request
   masuk ke TanStack Start): kalau error punya `statusCode` (misal
   `AppError` dari middleware auth), diteruskan apa adanya supaya pesan
   Bahasa Indonesia-nya sampai ke toast user. Kalau error lain (tak
   terduga), di-log dan dikembalikan sebagai halaman HTML fallback
   generik (`renderErrorPage()`).
2. **`server.ts`** — pembungkus paling luar di level HTTP fetch handler.
   Ada penanganan khusus untuk kasus h3 (server engine di balik Nitro)
   yang kadang "menelan" throw jadi Response 500 generik berformat
   `{"unhandled":true,...}` — kode ini mendeteksi pola itu dan
   menormalkannya jadi halaman error yang sama, sambil tetap mencoba log
   error asli lewat `error-capture.ts`.
3. **`error-capture.ts`** — menangkap error global
   (`window.addEventListener("error"/"unhandledrejection")`) dengan TTL
   5 detik, supaya error asli yang "hilang" di tahap 2 masih bisa
   direkonstruksi untuk logging.
4. Di sisi React: `errorComponent` di `__root.tsx` memanggil
   `reportError()` (dari `error-reporting.ts`) — saat ini cuma
   `console.error`, disiapkan sebagai titik integrasi kalau nanti mau
   pasang Sentry/Bugsnag.

### 4.6. Konfigurasi Server (`config.server.ts` & `supabase.server.ts`)

`config.server.ts` membaca env var lewat fungsi (bukan konstanta
level-modul) — ini disengaja, karena di platform seperti Cloudflare
Workers, env baru "bind" saat request masuk, jadi baca env di luar
fungsi bisa `undefined`.

`supabase.server.ts` membuat client Supabase dengan **`service_role`
key** — key dengan akses penuh yang **melewati semua Row Level Security
(RLS)** Postgres. Ini pola arsitektur yang disengaja (bukan kecelakaan):
karena semua query lewat `createServerFn` yang sudah dijaga
`authMiddleware`/`requireRole`/`assertOwnOutlet`, otorisasi ditegakkan
**di level aplikasi**, bukan di level RLS database. Konsekuensinya: RLS
di Supabase project ini kemungkinan besar tidak dipakai sebagai lapisan
pertahanan kedua — semua tanggung jawab keamanan data ada di kode
TypeScript ini.

---

## 5. Arsitektur Database (Supabase / Postgres)

> Skema di bawah direkonstruksi dari `src/lib/db/types.db.ts` (tipe yang
> di-generate otomatis oleh Supabase CLI dari schema asli), karena file
> `docs/schema.sql` yang disebut di README tidak tersedia.

### 5.1. Tabel

| Tabel | Kolom | Relasi |
|---|---|---|
| **`outlets`** | `id`, `nama_outlet`, `lokasi`, `created_at` | Tabel induk — direferensikan 3 tabel lain |
| **`products`** | `id`, `nama_produk`, `harga`, `kategori`, `is_active`, `created_at` | Tidak ada relasi keluar |
| **`profiles`** | `id` (= id user Supabase Auth), `nama`, `outlet_id`, `created_at` | `outlet_id` → `outlets.id` |
| **`user_roles`** | `id`, `user_id`, `role` (enum `app_role`) | — |
| **`allowed_emails`** | `email`, `role`, `outlet_id`, `created_at` | `outlet_id` → `outlets.id`; tabel whitelist pendaftaran |
| **`inventory`** | `id`, `outlet_id`, `nama_bahan`, `satuan`, `stok_awal`, `stok_masuk`, `stok_akhir`, `terpakai`, `tanggal`, `created_by` | `outlet_id` → `outlets.id` |
| **`sales_reports`** | `id`, `outlet_id`, `tanggal`, `total_penjualan`, `detail_item_terjual` (JSON), `created_by`, `created_at` | `outlet_id` → `outlets.id` |

- **Enum `app_role`**: `"hq_admin" | "outlet_staff"` — ini satu-satunya
  2 role di seluruh sistem.
- **Kolom `detail_item_terjual`** di `sales_reports` bertipe `Json` —
  array objek `{ product_id, nama, qty, subtotal }` disimpan sebagai
  JSONB, bukan tabel relasi terpisah (denormalisasi yang disengaja untuk
  kesederhanaan).
- **Unique constraint tersirat** dari kode: `sales_reports` di-upsert
  dengan `onConflict: "outlet_id,tanggal"` (1 baris per outlet per
  hari), `inventory` di-upsert dengan
  `onConflict: "outlet_id,nama_bahan,tanggal"` (1 baris per bahan per
  outlet per hari).

### 5.2. Fungsi Database (RPC, Postgres Functions)

Ada 2 fungsi Postgres yang dideklarasikan di
`Database["public"]["Functions"]`:

- **`get_my_outlet()`** — return `string` (kemungkinan dipakai untuk
  kebutuhan RLS policy, meski RLS sendiri di-bypass oleh service_role —
  ini indikasi arsitektur *awalnya* dirancang dengan RLS, lalu dialihkan
  ke otorisasi level-aplikasi).
- **`has_role(_user_id, _role)`** — return `boolean`, kemungkinan besar
  juga sisa dari desain RLS awal.

Kedua fungsi ini **tidak dipanggil di kode TypeScript manapun** yang
ditemukan — kemungkinan dipakai di dalam RLS policy Postgres langsung
(yang tidak ikut ter-zip), bukan dipanggil dari aplikasi.

### 5.3. Diagram Relasi (disederhanakan)

```
outlets (1) ──< profiles (banyak staff per outlet)
outlets (1) ──< allowed_emails (whitelist per outlet)
outlets (1) ──< inventory (banyak baris per hari)
outlets (1) ──< sales_reports (1 baris per hari, karena unique per tanggal)

profiles (1) ──1 user_roles   (relasi via auth.users id Supabase, bukan FK eksplisit di tipe ini)
products (berdiri sendiri, direferensikan via product_id di dalam JSON
          detail_item_terjual — bukan FK Postgres asli)
```

> Catatan: `product_id` di dalam JSON `detail_item_terjual` **bukan
> foreign key relasional** (karena disimpan sebagai JSONB, bukan kolom
> tabel) — integritas referensialnya hanya dijaga di level aplikasi
> (TypeScript), bukan di level database.

---

## 6. Alur Data End-to-End (Contoh Nyata)

Alur lengkap saat **staff outlet menyimpan data penjualan harian**:

1. **UI**: Staff buka `/app/outlet/sales` → route `app.outlet.sales.tsx`
   fetch daftar produk lewat `getProducts()`, tampilkan `<SalesForm/>`.
2. **Interaksi**: Staff pilih produk + qty di `SalesForm.tsx` →
   komponen hitung `subtotal` dan `total` secara reaktif di client
   (murni JS, belum menyentuh server).
3. **Submit**: Klik "Simpan Penjualan" → `handleSave()` di route
   memanggil `upsertSales({ data: { outlet_id, tanggal: today,
   total_penjualan, detail_item_terjual } })`.
4. **Client middleware**: `authMiddleware.client()` mengambil
   `access_token` dari sesi Supabase browser saat ini, dikirim ke
   server.
5. **HTTP request**: TanStack Start mengubah pemanggilan fungsi ini jadi
   HTTP request otomatis ke endpoint server function yang di-generate.
6. **Server middleware**: `authMiddleware.server()` verifikasi token ke
   Supabase Auth → ambil `profile` & `role` → simpan di `context.auth`.
7. **Handler `upsertSales`**: panggil `assertOwnOutlet(context.auth,
   data.outlet_id)` — kalau staff coba kirim `outlet_id` outlet lain,
   ditolak 403 di sini, walau UI sudah "dikelabui".
8. **Database**: `getSupabaseAdmin().from("sales_reports").upsert(...)`
   dengan `created_by: context.auth.userId` (bukan dari input client) →
   Supabase Postgres simpan/update baris (upsert berdasar
   `outlet_id + tanggal`).
9. **Response**: Data tersimpan dikembalikan ke client →
   `toast.success("Data penjualan berhasil disimpan!")` muncul lewat
   `sonner`.
10. **Downstream**: Data ini otomatis muncul di dashboard HQ
    (`getDashboardSummary`) dan di laporan PDF (`getSales` +
    `ReportPDF.tsx`) saat admin mengaksesnya — karena semuanya membaca
    dari tabel `sales_reports` yang sama.

---

## 7. Ringkasan Karakter Arsitektur

- **Keamanan**: bertumpu 100% di aplikasi (middleware server function),
  bukan RLS Postgres — desain yang konsisten dan sengaja, meski artinya
  kesalahan sekecil apa pun di middleware langsung jadi celah keamanan
  nyata (untungnya implementasinya sejauh ini rapi).
- **Tidak ada REST API terpisah** — semua komunikasi client↔server
  lewat RPC `createServerFn`, jadi tidak ada dokumentasi endpoint
  terpisah (Swagger/OpenAPI) yang perlu dijaga — kontrak API-nya
  *adalah* kode TypeScript itu sendiri (type-safe end-to-end).
- **Database sebagai single source of truth**, diakses eksklusif lewat
  service_role key dari server — browser tidak pernah bicara langsung
  ke Supabase untuk data privat (kecuali `use-auth.tsx` yang query
  `profiles`/`user_roles` pakai anon key untuk keperluan tampilan cepat
  di client, yang **tidak** dipakai untuk keputusan otorisasi
  tulis-data, hanya untuk UI).

---

*Dokumen ini dibuat berdasarkan pembacaan menyeluruh source code project
per Juli 2026. Perbarui bagian yang relevan setiap kali ada perubahan
signifikan pada skema database, alur autentikasi, atau struktur route.*
