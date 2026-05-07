import type { Context, Next } from "hono";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { importJWK } from "jose";

const JWT_SECRET = process.env.JWT_SECRET ?? "changeme";

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized", message: "Missing Bearer token" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    c.set("jwtPayload", payload);
    await next();
  } catch {
    return c.json({ error: "Unauthorized", message: "Invalid or expired token" }, 401);
  }
}
