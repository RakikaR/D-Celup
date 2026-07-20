/**
 * src/lib/api/outlets.functions.ts
 *
 * Endpoint baca: siapa pun yang sudah login boleh akses (authMiddleware).
 * Endpoint tulis (createOutlet, upsertProduct, deactivateProduct): HANYA
 * hq_admin (requireRole) — data ini berlaku lintas-outlet, jadi tidak
 * masuk akal kalau staff outlet bisa mengubahnya.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/db/supabase.server";
import { authMiddleware, requireRole } from "@/lib/auth/auth.middleware";

export const getOutlets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("outlets")
      .select("id, nama_outlet, lokasi")
      .order("nama_outlet");
    if (error) throw new Error(`Gagal mengambil data outlet: ${error.message}`);
    return data;
  });

export const createOutlet = createServerFn({ method: "POST" })
  .middleware([requireRole("hq_admin")])
  .inputValidator(z.object({
    nama_outlet: z.string().min(1),
    lokasi: z.string().optional(),
  }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { data: outlet, error } = await supabase
      .from("outlets")
      .insert({ nama_outlet: data.nama_outlet, lokasi: data.lokasi ?? null })
      .select()
      .single();
    if (error) throw new Error(`Gagal membuat outlet: ${error.message}`);
    return outlet;
  });

export const getProducts = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("products")
      .select("id, nama_produk, harga, kategori, is_active")
      .order("kategori")
      .order("nama_produk");
    if (error) throw new Error(`Gagal mengambil data produk: ${error.message}`);
    return data;
  });

export const upsertProduct = createServerFn({ method: "POST" })
  .middleware([requireRole("hq_admin")])
  .inputValidator(z.object({
    id: z.string().optional(),
    nama_produk: z.string().min(1),
    harga: z.number().min(0),
    kategori: z.string().optional(),
    is_active: z.boolean().default(true),
  }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    if (data.id) {
      const { data: updated, error } = await supabase
        .from("products")
        .update({ nama_produk: data.nama_produk, harga: data.harga, kategori: data.kategori ?? null, is_active: data.is_active })
        .eq("id", data.id).select().single();
      if (error) throw new Error(`Gagal update produk: ${error.message}`);
      return updated;
    } else {
      const { data: created, error } = await supabase
        .from("products")
        .insert({ nama_produk: data.nama_produk, harga: data.harga, kategori: data.kategori ?? null, is_active: data.is_active })
        .select().single();
      if (error) throw new Error(`Gagal membuat produk: ${error.message}`);
      return created;
    }
  });

export const deactivateProduct = createServerFn({ method: "POST" })
  .middleware([requireRole("hq_admin")])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", data.id);
    if (error) throw new Error(`Gagal menonaktifkan produk: ${error.message}`);
    return { success: true };
  });
