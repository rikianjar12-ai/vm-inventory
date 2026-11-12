"use client";

function isDbError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("connect") ||
    text.includes("econnrefused") ||
    text.includes("password") ||
    text.includes("database") ||
    text.includes("enotfound") ||
    text.includes("timeout")
  );
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dbError = isDbError(error.message);

  return (
    <div className="card confirm-card">
      <h2>{dbError ? "Gagal terhubung ke database" : "Terjadi kesalahan"}</h2>
      {dbError ? (
        <p>
          Pastikan PostgreSQL berjalan dan database <code>vm_inventory</code>{" "}
          sudah dibuat. Kredensial default ada di <code>.env.local</code>.
        </p>
      ) : (
        <p>Halaman gagal dimuat. Coba muat ulang atau kembali ke dashboard.</p>
      )}
      <p className="error-detail">{error.message}</p>
      <div className="form-actions">
        <button className="btn btn-primary" type="button" onClick={reset}>
          Coba lagi
        </button>
        <a className="btn btn-ghost" href="/">
          Kembali ke dashboard
        </a>
      </div>
    </div>
  );
}
