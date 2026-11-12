export const SESSION_COOKIE = "vm_inventory_session";
export const SESSION_HOURS = 12;

export type SessionPayload = {
  id: number;
  username: string;
  role: "admin" | "operator";
  exp: number;
};

export function getAuthSecret() {
  return (
    process.env.AUTH_SECRET ||
    "vm-inventory-dev-secret-ganti-di-env-local-32ch"
  );
}

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function utf8(value: string) {
  return new TextEncoder().encode(value);
}

async function hmacHex(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, utf8(message));
  return bytesToHex(sig);
}

function base64UrlEncode(value: string) {
  const bytes = utf8(value);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function signSession(payload: SessionPayload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacHex(body, getAuthSecret());
  return `${body}.${sig}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const split = token.lastIndexOf(".");
  if (split < 1) return null;
  const body = token.slice(0, split);
  const sig = token.slice(split + 1).toLowerCase();
  const expected = (await hmacHex(body, getAuthSecret())).toLowerCase();
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i += 1) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(body)) as SessionPayload;
    if (!payload?.id || !payload.username || !payload.role) return null;
    if (payload.role !== "admin" && payload.role !== "operator") return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function sessionExpiry() {
  return Math.floor(Date.now() / 1000) + SESSION_HOURS * 60 * 60;
}
