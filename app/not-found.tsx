import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <h2>Data tidak ditemukan</h2>
      <p>VM atau kolom yang diminta tidak ada.</p>
      <Link className="btn btn-primary" href="/">
        Kembali ke dashboard
      </Link>
    </div>
  );
}
