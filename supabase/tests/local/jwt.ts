// توقيع والتحقق من JWT بخوارزمية HS256 (للاختبار المحلي فقط).

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export type Claims = Record<string, unknown> & { role: string; sub?: string; email?: string; exp?: number };

export async function signJwt(claims: Claims, secret: string): Promise<string> {
  const header = base64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64url(encoder.encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
}

/** يعيد الـ claims إن كان التوقيع صحيحًا وغير منتهٍ، وإلا null. */
export async function verifyJwt(token: string, secret: string): Promise<Claims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    fromBase64url(signature),
    encoder.encode(`${header}.${payload}`),
  );
  if (!valid) return null;
  const claims = JSON.parse(new TextDecoder().decode(fromBase64url(payload))) as Claims;
  if (typeof claims.exp === "number" && claims.exp < Date.now() / 1000) return null;
  return claims;
}
