/** Inline fallback so the login fields stay visible even if layout.css 404s. */
export const LOGIN_CRITICAL_CSS = `
body:has(.login-stage){min-height:100dvh;background:#041018;margin:0}
.login-stage{position:relative;isolation:isolate;min-height:100dvh;overflow:auto;color:#eef6ff}
.login-visual{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.login-photo{display:block;width:100%;height:100%;object-fit:cover;object-position:center 58%}
.login-content{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(20rem,26rem);gap:2rem;align-items:center;min-height:100dvh;width:min(1180px,calc(100% - 2.5rem));margin:0 auto;padding:2rem 0}
.login-card{position:relative;z-index:3;width:100%;padding:1.4rem;border-radius:1.4rem;background:#08141c;border:1px solid rgba(150,220,255,.28);color:#eef6ff;box-sizing:border-box}
.login-card h2,.login-card p,.login-card label{position:relative;z-index:3}
.login-card .field{display:flex;flex-direction:column;gap:.35rem;margin:0 0 .85rem}
.login-card input{width:100%;min-height:2.75rem;padding:.6rem .75rem;border-radius:.75rem;border:1px solid rgba(180,220,240,.45);background:#07141c;color:#f3f9ff;box-sizing:border-box}
.login-card .btn-primary{display:inline-flex;align-items:center;justify-content:center;width:100%;min-height:2.75rem;margin-top:.5rem;border-radius:999px;border:1px solid #5eead4;background:transparent;color:#5eead4;font-weight:700;cursor:pointer}
@media (max-width:56.25rem){.login-content{grid-template-columns:1fr;width:min(100% - 1.5rem,28rem);align-content:end}}
`;
