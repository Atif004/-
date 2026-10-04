// بوابة محلية تحاكي عنوان مشروع Supabase للاختبار فقط:
//   /rest/v1/*                      → PostgREST الحقيقي (مع RLS والـ migrations الفعلية)
//   GET    /auth/v1/user            → يتحقق من JWT ويعيد المستخدم من auth.users
//   DELETE /auth/v1/admin/users/:id → بتوكن service_role فقط، يحذف المستخدم من auth.users
//
// المتغيرات: GATEWAY_PORT, POSTGREST_URL, DATABASE_URL, JWT_SECRET

import postgres from "npm:postgres@3.4.5";
import { verifyJwt } from "./jwt.ts";

const port = Number(Deno.env.get("GATEWAY_PORT") ?? "54321");
const postgrestUrl = Deno.env.get("POSTGREST_URL") ?? "http://127.0.0.1:54331";
const secret = Deno.env.get("JWT_SECRET")!;
const sql = postgres(Deno.env.get("DATABASE_URL")!, { max: 2, onnotice: () => {} });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function bearer(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function handleAuth(req: Request, path: string): Promise<Response> {
  const token = bearer(req);
  const claims = token ? await verifyJwt(token, secret) : null;
  if (!claims) return json({ code: 401, error_code: "bad_jwt", msg: "invalid JWT" }, 401);

  if (req.method === "GET" && path === "/user") {
    if (!claims.sub) return json({ code: 403, msg: "no user in token" }, 403);
    const rows = await sql`select id, email, raw_user_meta_data, created_at from auth.users where id = ${claims.sub}`;
    if (rows.length === 0) return json({ code: 403, error_code: "user_not_found", msg: "User not found" }, 403);
    const u = rows[0];
    return json({
      id: u.id,
      aud: "authenticated",
      role: "authenticated",
      email: u.email,
      app_metadata: {},
      user_metadata: u.raw_user_meta_data,
      created_at: u.created_at,
    });
  }

  const adminDelete = path.match(/^\/admin\/users\/([0-9a-f-]{36})$/);
  if (req.method === "DELETE" && adminDelete) {
    if (claims.role !== "service_role") return json({ code: 403, msg: "service_role required" }, 403);
    const deleted = await sql`delete from auth.users where id = ${adminDelete[1]} returning id`;
    if (deleted.length === 0) return json({ code: 404, msg: "User not found" }, 404);
    return json({ id: deleted[0].id });
  }

  return json({ code: 404, msg: `not implemented in test gateway: ${req.method} ${path}` }, 404);
}

async function proxyRest(req: Request, path: string, search: string): Promise<Response> {
  const headers = new Headers(req.headers);
  headers.delete("host");
  const upstream = await fetch(`${postgrestUrl}${path}${search}`, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
  });
  return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
}

Deno.serve({ port, hostname: "127.0.0.1", onListen: () => console.log(`gateway listening on ${port}`) }, (req) => {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/rest/v1")) {
    return proxyRest(req, url.pathname.slice("/rest/v1".length) || "/", url.search);
  }
  if (url.pathname.startsWith("/auth/v1")) {
    return handleAuth(req, url.pathname.slice("/auth/v1".length));
  }
  return json({ msg: "not found" }, 404);
});
