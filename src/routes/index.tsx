import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Index,
});

/**
 * Halaman root ("/") murni berfungsi sebagai router: tidak render apa-apa,
 * hanya menunggu status auth Supabase selesai lalu redirect ke halaman
 * yang sesuai.
 *
 * CATATAN: sebelumnya route ini pakai loader yang mengecek
 * `localStorage.getItem("dceLup_auth_user")` — sisa dari implementasi
 * mock-auth lama. Sejak use-auth.tsx dimigrasi ke Supabase session,
 * tidak ada lagi kode yang menulis ke key tersebut, sehingga logic lama
 * itu jadi dead code dan halaman ini selalu redirect ke /auth walau user
 * sudah login. Sekarang redirect memakai `useAuth()` yang sama dengan
 * yang dipakai di seluruh app (lihat routes/app.tsx).
 */
function Index() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (!user) {
      navigate({ to: "/auth", replace: true });
      return;
    }

    if (user.role === "hq_admin") {
      navigate({ to: "/app/hq", replace: true });
    } else {
      navigate({ to: "/app/outlet", replace: true });
    }
  }, [isLoading, user, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-red border-t-transparent" />
    </div>
  );
}
