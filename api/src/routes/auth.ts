import { Hono } from "hono";
import { SignJWT } from "jose";
import { z } from "zod";

const router = new Hono();

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

router.post("/login", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "username and password are required" }, 400);
  }

  const { username, password } = parsed.data;
  const adminUser = process.env.ADMIN_USERNAME ?? "admin";
  const adminPass = process.env.ADMIN_PASSWORD ?? "admin";

  if (username !== adminUser || password !== adminPass) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "changeme");
  const token = await new SignJWT({ sub: username, role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secret);

  return c.json({
    token,
    user: { username, role: "admin" },
    expiresIn: 86400,
  });
});

export default router;
