/**
 * src/lib/api/sales.functions.ts
 *
 * Semua endpoint butuh login (authMiddleware). Untuk outlet_staff, akses
 * SELALU dipaksa ke outlet miliknya sendiri (dari context.auth, bukan
 * dari data yang dikirim client) — lihat resolveOutletId/assertOwnOutlet.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/db/supabase.server";
import {
  AppError,
  authMiddleware,
  assertOwnOutlet,
  type AuthUser,
} from "@/lib/auth/auth.middleware";

const SalesDetailSchema = z.object({
  product_id: z.string(),
  nama: z.string(),
  qty: z.number().int().min(0),
  subtotal: z.number().min(0),
});

/**
 * Untuk endpoint baca yang outlet_id-nya opsional: hq_admin boleh pilih
 * outlet_id apa saja (atau kosong untuk semua outlet), outlet_staff
 * SELALU dipaksa ke outlet miliknya sendiri, apapun yang dikirim client.
 */
function resolveReadableOutletId(auth: AuthUser, requested?: string) {
  if (auth.role === "hq_admin") return requested;
  if (!auth.outletId) {
    throw new AppError("Akun ini belum terhubung ke outlet manapun.", 403);
  }
  return auth.outletId;
}

export const getSales = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({
    outlet_id: z.string().optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }))
  .handler(async ({ data, context }) => {
    const outletId = resolveReadableOutletId(context.auth, data.outlet_id);
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("sales_reports")
      .select("id, outlet_id, tanggal, total_penjualan, detail_item_terjual, created_at")
      .order("tanggal", { ascending: false });
    if (outletId) query = query.eq("outlet_id", outletId);
    if (data.from) query = query.gte("tanggal", data.from);
    if (data.to) query = query.lte("tanggal", data.to);
    const { data: reports, error } = await query;
    if (error) throw new Error(`Gagal mengambil data penjualan: ${error.message}`);
    return reports;
  });

export const getSalesByDate = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({
    outlet_id: z.string(),
    tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }))
  .handler(async ({ data, context }) => {
    assertOwnOutlet(context.auth, data.outlet_id);
    const supabase = getSupabaseAdmin();
    const { data: report, error } = await supabase
      .from("sales_reports")
      .select("*")
      .eq("outlet_id", data.outlet_id)
      .eq("tanggal", data.tanggal)
      .maybeSingle();
    if (error) throw new Error(`Gagal mengambil laporan: ${error.message}`);
    return report;
  });

export const upsertSales = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({
    outlet_id: z.string(),
    tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    total_penjualan: z.number().min(0),
    detail_item_terjual: z.array(SalesDetailSchema),
  }))
  .handler(async ({ data, context }) => {
    // Tolak kalau staff outlet lain mencoba menyimpan data untuk outlet ini.
    assertOwnOutlet(context.auth, data.outlet_id);

    const supabase = getSupabaseAdmin();
    const { data: saved, error } = await supabase
      .from("sales_reports")
      .upsert({
        outlet_id: data.outlet_id,
        tanggal: data.tanggal,
        total_penjualan: data.total_penjualan,
        detail_item_terjual: data.detail_item_terjual,
        // created_by diambil dari identitas server-side yang sudah
        // diverifikasi, BUKAN dari input client, supaya tidak bisa
        // dipalsukan atas nama user lain.
        created_by: context.auth.userId,
      }, { onConflict: "outlet_id,tanggal" })
      .select().single();
    if (error) throw new Error(`Gagal menyimpan laporan penjualan: ${error.message}`);
    return saved;
  });
