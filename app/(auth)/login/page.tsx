import Image from "next/image";
import { loginAction } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="login-stage">
      <div className="login-content">
        <div className="login-intro">
          <Image
            src="/lrt-logo-white.png"
            alt="LRT Jabodebek"
            width={280}
            height={120}
            className="login-logo"
            priority
          />
          <p className="login-kicker">PT Kereta Api Indonesia · LRT Jabodebek</p>
          <h1>Datacenter Operations</h1>
          <p className="login-lead">
            Inventory server dan virtual machine. Masuk untuk mengelola status,
            spesifikasi, dan versi aplikasi.
          </p>
        </div>

        <form className="login-card" action={loginAction}>
          <h2>
            Masuk ke <span className="accent">inventory</span>
          </h2>
          <p>Gunakan username dan password yang terdaftar.</p>
          {params.err ? <div className="flash flash-err">{params.err}</div> : null}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" type="submit">
              Masuk
            </button>
          </div>
        </form>
      </div>

      <div className="login-visual" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/login-hero.jpg" alt="" className="login-photo" />
        <div className="login-grade" />
        <div className="login-glow" />
        <div className="login-grain" />
      </div>
    </div>
  );
}
