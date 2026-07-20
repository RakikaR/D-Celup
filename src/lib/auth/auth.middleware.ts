/**
 * src/lib/auth/auth.middleware.ts
 *
 * Lapisan otorisasi untuk SEMUA createServerFn yang menyentuh data privat.
 *
 * KENAPA INI PERLU:
 * Guard di level route (mis. `HqGuard` di app.hq.tsx) hanya menyembunyikan
 * UI di browser lewat redirect. Tapi setiap `createServerFn` tetap jadi
 * endpoint HTTP publik yang bisa dipanggil langsung (via fetch/curl),
 * dengan atau tanpa UI-nya, dan dengan atau tanpa role yang "seharusnya".
 * Middleware ini adalah lapisan yang benar-benar menjaga data — bukan UI.
 *
 * ALUR VERIFIKASI:
 * 1. `.client()` mengambil access_token dari sesi Supabase yang sedang
 *    aktif di browser, lalu mengirimkannya ke server lewat `sendContext`
 *    (mekanisme resmi TanStack Start untuk membawa data dari client
 *    middleware ke server middleware — bukan header manual).
 * 2. `.server()` MEMVERIFIKASI ULANG token itu ke Supabase Auth. Token
 *    dari client tidak pernah dipercaya isinya secara langsung — hanya
 *    dipakai sebagai kunci untuk mengambil identitas asli dari sumber
 *    yang tepercaya (Supabase Auth + tabel profiles/user_roles).
 * 3. Identitas yang sudah diverifikasi ditaruh di `context.auth`. Inilah
 *    SATU-SATUNYA sumber identitas yang boleh dipakai di dalam handler —
 *    jangan pernah percaya `outlet_id`/`user_id`/`role` yang dikirim
 *    lewat `data` dari client untuk keperluan otorisasi.
 */

import { createMiddleware } from "@tanstack/react-start";
import { supabase as supabaseBrowser } from "@/hooks/use-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase.server";
import type { Role } from "@/lib/data/types";

export interface AuthUser {
  userId: string;
  email: string;
  nama: string;
  role: Role;
  /** null jika user belum terhubung ke outlet manapun (mis. HQ admin). */
  outletId: string | null;
}

/**
 * Error dengan statusCode dikenali oleh `errorMiddleware` di start.ts dan
 * dilempar apa adanya ke client (bukan dibungkus jadi halaman 500 generik),
 * jadi pesan bahasa Indonesia di bawah ini akan sampai ke user/toast.
 */
export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
  }
}

/**
 * authMiddleware — pasang di SETIAP server function yang butuh user login.
 * Menyediakan `context.auth: AuthUser` yang sudah terverifikasi ke handler.
 *
 * Contoh pemakaian langsung (untuk endpoint yang boleh diakses siapa pun
 * yang sudah login, apapun role-nya):
 *
 *   export const getProducts = createServerFn({ method: "GET" })
 *     .middleware([authMiddleware])
 *     .handler(async ({ context }) => {
 *       console.log(context.auth.role); // "hq_admin" | "outlet_staff"
 *     });
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const {
      data: { session },
    } = await supabaseBrowser.auth.getSession();

    return next({
      sendContext: {
        accessToken: session?.access_token ?? null,
      },
    });
  })
  .server(async ({ next, context }) => {
    const token = (context as { accessToken: string | null }).accessToken;

    if (!token) {
      throw new AppError("Anda harus login untuk melakukan aksi ini.", 401);
    }

    const supabase = getSupabaseAdmin();

    // Verifikasi token ke Supabase Auth — bukan sekadar decode isinya.
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      throw new AppError("Sesi sudah tidak valid. Silakan login ulang.", 401);
    }

    const userId = userData.user.id;

    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase
        .from("profiles")
        .select("nama, outlet_id")
        .eq("id", userId)
        .single(),
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
    ]);

    if (!roleRow) {
      throw new AppError(
        "Akun ini belum memiliki hak akses. Hubungi Admin Pusat.",
        403,
      );
    }

    const auth: AuthUser = {
      userId,
      email: userData.user.email ?? "",
      nama: profile?.nama ?? "",
      role: roleRow.role as Role,
      outletId: profile?.outlet_id ?? null,
    };

    return next({ context: { auth } });
  });

/**
 * requireRole(...roles) — middleware factory. Membatasi endpoint hanya
 * untuk role tertentu. Sudah menyertakan authMiddleware di dalamnya, jadi
 * TIDAK perlu ditulis dua-duanya — cukup pasang requireRole saja.
 *
 * Contoh: hanya HQ admin yang boleh membuat outlet baru.
 *
 *   export const createOutlet = createServerFn({ method: "POST" })
 *     .middleware([requireRole("hq_admin")])
 *     .inputValidator(...)
 *     .handler(async ({ data, context }) => {
 *       context.auth.role; // sudah pasti "hq_admin" di titik ini
 *     });
 */
export function requireRole(...roles: Role[]) {
  return createMiddleware({ type: "function" })
    .middleware([authMiddleware])
    .server(async ({ next, context }) => {
      if (!roles.includes(context.auth.role)) {
        throw new AppError(
          `Akses ditolak. Aksi ini hanya untuk peran: ${roles.join(", ")}.`,
          403,
        );
      }
      return next();
    });
}

/**
 * assertOwnOutlet — dipanggil DI DALAM handler (bukan sebagai middleware)
 * untuk memastikan outlet_staff hanya bisa baca/tulis data outlet miliknya
 * sendiri. HQ admin selalu boleh akses semua outlet.
 *
 * WAJIB dipanggil di setiap handler yang menerima `outlet_id` dari `data`,
 * karena `data.outlet_id` datang dari client dan bisa saja dimanipulasi
 * (mis. staff Outlet A mengubah request agar outlet_id-nya Outlet B).
 */
export function assertOwnOutlet(auth: AuthUser, outletId: string) {
  if (auth.role === "hq_admin") return;
  if (auth.outletId !== outletId) {
    throw new AppError("Anda tidak memiliki akses ke outlet ini.", 403);
  }
}
