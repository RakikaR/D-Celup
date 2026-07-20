/**
 * src/lib/api/inventory.functions.ts
 *
 * Semua endpoint butuh login (authMiddleware) dan dibatasi ke outlet
 * milik user yang login (assertOwnOutlet) — hq_admin bebas akses semua.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/db/supabase.server";
import { AppError, authMiddleware, assertOwnOutlet } from "@/lib/auth/auth.middleware";

export const getInventory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({
    outlet_id: z.string(),
    tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }))
  .handler(async ({ data, context }) => {
    assertOwnOutlet(context.auth, data.outlet_id);
    const supabase = getSupabaseAdmin();
    const { data: items, error } = await supabase
      .from("inventory")
      .select("id, outlet_id, nama_bahan, satuan, stok_awal, stok_masuk, stok_akhir, terpakai, tanggal")
      .eq("outlet_id", data.outlet_id)
      .eq("tanggal", data.tanggal)
      .order("nama_bahan");
    if (error) throw new Error(`Gagal mengambil data inventory: ${error.message}`);
    return items;
  });

export const getInventoryHistory = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(z.object({
    outlet_id: z.string(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }))
  .handler(async ({ data, context }) => {
    assertOwnOutlet(context.auth, data.outlet_id);
    const supabase = getSupabaseAdmin();
    const { data: items, error } = await supabase
      .from("inventory")
      .select("id, outlet_id, nama_bahan, satuan, stok_awal, stok_masuk, stok_akhir, terpakai, tanggal")
      .eq("outlet_id", data.outlet_id)
      .gte("tanggal", data.from)
      .lte("tanggal", data.to)
      .order("tanggal", { ascending: false })
      .order("nama_bahan");
    if (error) throw new Error(`Gagal mengambil riwayat inventory: ${error.message}`);
    return items;
  });

const InventoryItemSchema = z.object({
  outlet_id: z.string(),
  nama_bahan: z.string().min(1),
  satuan: z.string().min(1),
  stok_awal: z.number().min(0),
  stok_masuk: z.number().min(0),
  stok_akhir: z.number().min(0),
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const upsertInventory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ items: z.array(InventoryItemSchema).min(1) }))
  .handler(async ({ data, context }) => {
    // Semua item dalam satu batch wajib milik outlet yang sama, dan
    // wajib outlet milik user yang login (kecuali hq_admin).
    const outletIds = new Set(data.items.map((item) => item.outlet_id));
    if (outletIds.size > 1) {
      throw new AppError("Satu batch inventory hanya boleh untuk satu outlet.", 400);
    }
    for (const outletId of outletIds) {
      assertOwnOutlet(context.auth, outletId);
    }

    const supabase = getSupabaseAdmin();
    const { data: saved, error } = await supabase
      .from("inventory")
      .upsert(
        data.items.map((item) => ({
          outlet_id: item.outlet_id,
          nama_bahan: item.nama_bahan,
          satuan: item.satuan,
          stok_awal: item.stok_awal,
          stok_masuk: item.stok_masuk,
          stok_akhir: item.stok_akhir,
          tanggal: item.tanggal,
          // created_by diambil dari identitas server-side yang sudah
          // diverifikasi, bukan dari input client.
          created_by: context.auth.userId,
        })),
        { onConflict: "outlet_id,nama_bahan,tanggal", ignoreDuplicates: false },
      )
      .select("id, outlet_id, nama_bahan, satuan, stok_awal, stok_masuk, stok_akhir, terpakai, tanggal");
    if (error) throw new Error(`Gagal menyimpan data inventory: ${error.message}`);
    return saved;
  });

export const deleteInventoryItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data, context }) => {
    const supabase = getSupabaseAdmin();

    // Item belum tentu milik outlet user ini — cek dulu sebelum hapus,
    // karena input-nya cuma `id`, tidak ada outlet_id yang bisa divalidasi
    // langsung dari data.
    const { data: existing, error: findError } = await supabase
      .from("inventory")
      .select("outlet_id")
      .eq("id", data.id)
      .maybeSingle();
    if (findError) throw new Error(`Gagal memeriksa item inventory: ${findError.message}`);
    if (!existing) throw new AppError("Item inventory tidak ditemukan.", 404);

    assertOwnOutlet(context.auth, existing.outlet_id);

    const { error } = await supabase.from("inventory").delete().eq("id", data.id);
    if (error) throw new Error(`Gagal menghapus item inventory: ${error.message}`);
    return { success: true };
  });
