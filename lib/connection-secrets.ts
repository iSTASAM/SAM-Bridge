import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function encryptionSecret() {
  const dedicated = process.env.CONNECTIONS_ENCRYPTION_KEY?.trim();
  if (dedicated) return dedicated;
  const fallback = process.env.AUTH_PASSWORD?.trim();
  if (fallback) return fallback;
  return "";
}

export function connectionSecretsConfigured() {
  return Boolean(encryptionSecret());
}

function keyBytes() {
  const secret = encryptionSecret();
  if (!secret) {
    throw new Error("CONNECTIONS_ENCRYPTION_KEY_MISSING");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

/** Encrypt a credential field for durable storage. Empty stays empty. */
export function encryptSecret(plain: string): string {
  const value = plain ?? "";
  if (!value) return "";
  if (value.startsWith(PREFIX)) return value;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, tag, encrypted]).toString("base64url")}`;
}

/**
 * Decrypt a stored field. Legacy plaintext (pre-encryption) is returned as-is
 * so existing rows keep working until the next save re-encrypts them.
 */
export function decryptSecret(stored: string): string {
  const value = stored ?? "";
  if (!value) return "";
  if (!value.startsWith(PREFIX)) return value;

  const raw = Buffer.from(value.slice(PREFIX.length), "base64url");
  if (raw.length < 28) {
    throw new Error("CONNECTIONS_SECRET_CORRUPT");
  }
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const data = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("CONNECTIONS_DECRYPT_FAILED");
  }
}

export function encryptCustomerOptions(
  customers: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  return customers.map((customer) => ({
    id: encryptSecret(customer.id),
    name: customer.name,
  }));
}

export function decryptCustomerOptions(
  customers: Array<{ id: string; name: string }>,
): Array<{ id: string; name: string }> {
  return customers.map((customer) => ({
    id: decryptSecret(customer.id),
    name: customer.name,
  }));
}
