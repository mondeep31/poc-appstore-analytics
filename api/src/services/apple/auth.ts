import { SignJWT, importPKCS8 } from "jose";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

function getConfig() {
  const keyId = process.env.APPLE_KEY_ID;
  const issuerId = process.env.APPLE_ISSUER_ID;
  const privateKeyBase64 = process.env.APPLE_PRIVATE_KEY_BASE64;

  if (!keyId || !issuerId || !privateKeyBase64) {
    throw new Error(
      "Missing Apple ASC credentials: APPLE_KEY_ID, APPLE_ISSUER_ID, APPLE_PRIVATE_KEY_BASE64",
    );
  }

  const privateKeyPem = Buffer.from(privateKeyBase64, "base64").toString(
    "utf-8",
  );

  return { keyId, issuerId, privateKeyPem };
}

export async function getAscToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Reuse cached token if still valid (with 60s buffer)
  if (cache && cache.expiresAt - now > 60) {
    return cache.token;
  }

  const { keyId, issuerId, privateKeyPem } = getConfig();
  const exp = now + 20 * 60; // 20 minutes

  const privateKey = await importPKCS8(privateKeyPem, "ES256");

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(issuerId)
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setAudience("appstoreconnect-v1")
    .sign(privateKey);

  cache = { token, expiresAt: exp };
  return token;
}

export async function ascFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAscToken();
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}
