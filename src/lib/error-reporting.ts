/**
 * src/lib/error-reporting.ts
 *
 * Titik tunggal untuk melaporkan error yang tertangkap React Error
 * Boundary (lihat ErrorComponent di routes/__root.tsx).
 *
 * Saat ini hanya mencatat ke console dengan konteks tambahan. Kalau nanti
 * mau pakai layanan monitoring (Sentry, Bugsnag, dll), cukup ganti isi
 * fungsi ini — pemanggilnya di __root.tsx tidak perlu berubah.
 */

export function reportError(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  console.error("[error-reporting]", error, context ?? {});

  // Contoh kalau nanti mau sambungkan ke Sentry:
  // Sentry.captureException(error, { extra: context });
}
