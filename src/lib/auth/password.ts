// ---------------------------------------------------------------------------
// Password Hashing — PBKDF2 via Web Crypto
// ---------------------------------------------------------------------------
// Uses the built-in Web Crypto API (no bcrypt/argon2 native deps).
// Works everywhere: Node.js, Edge Runtime, serverless.
//
// Security:
//   PBKDF2-SHA512, 210K iterations, 32-byte salt, 64-byte hash
//   OWASP recommended minimum: 210K iterations for SHA-512.
// ---------------------------------------------------------------------------

const ITERATIONS = 210_000;
const KEY_LENGTH = 64; // bytes
const HASH_ALGORITHM = "SHA-512";

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function derive(
  password: string,
  salt: Uint8Array
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: HASH_ALGORITHM },
    key,
    KEY_LENGTH * 8
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const hash = await derive(password, salt);
  return `${bufferToHex(salt.buffer as ArrayBuffer)}:${bufferToHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = hexToBytes(saltHex);
  const hash = await derive(password, salt);
  return bufferToHex(hash) === hashHex;
}
