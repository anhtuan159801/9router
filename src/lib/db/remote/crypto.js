import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = 1;
const MAX_PLAINTEXT_BYTES = 10 * 1024 * 1024;
// Base64 and the JSON envelope add overhead. Reject unreasonable input before
// decoding/parsing so a corrupted remote row cannot cause excessive allocation.
const MAX_CIPHERTEXT_CHARS = 20 * 1024 * 1024;

function checksum(value) { return createHash("sha256").update(value).digest("hex"); }

export function encryptSnapshot(payload, key) {
  const plaintext = Buffer.from(JSON.stringify(payload));
  if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error("Snapshot exceeds maximum size");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(`9router:${ENVELOPE_VERSION}`));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope = JSON.stringify({ version: ENVELOPE_VERSION, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
  return { ciphertext: Buffer.from(envelope).toString("base64"), checksum: checksum(envelope) };
}

export function decryptSnapshot(ciphertext, expectedChecksum, key) {
  if (typeof ciphertext !== "string" || ciphertext.length === 0 || ciphertext.length > MAX_CIPHERTEXT_CHARS || !/^[A-Za-z0-9+/]+={0,2}$/.test(ciphertext)) {
    throw new Error("Snapshot encoding is invalid");
  }
  if (typeof expectedChecksum !== "string" || !/^[a-f0-9]{64}$/.test(expectedChecksum)) {
    throw new Error("Snapshot checksum is invalid");
  }
  let envelopeText;
  try {
    const decoded = Buffer.from(ciphertext, "base64");
    if (decoded.toString("base64") !== ciphertext) throw new Error();
    envelopeText = decoded.toString("utf8");
  } catch { throw new Error("Snapshot encoding is invalid"); }
  if (checksum(envelopeText) !== expectedChecksum) throw new Error("Snapshot checksum mismatch");
  let envelope;
  try { envelope = JSON.parse(envelopeText); } catch { throw new Error("Snapshot envelope is invalid"); }
  if (envelope.version !== ENVELOPE_VERSION) throw new Error("Unsupported snapshot envelope version");
  if (typeof envelope.iv !== "string" || typeof envelope.tag !== "string" || typeof envelope.data !== "string") {
    throw new Error("Snapshot envelope is invalid");
  }
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  if (iv.length !== 12 || tag.length !== 16 || iv.toString("base64") !== envelope.iv || tag.toString("base64") !== envelope.tag) {
    throw new Error("Snapshot envelope is invalid");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(`9router:${ENVELOPE_VERSION}`));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
    if (plaintext.length > MAX_PLAINTEXT_BYTES) throw new Error("Snapshot exceeds maximum size");
    return JSON.parse(plaintext.toString("utf8"));
  } catch (error) {
    if (error.message === "Snapshot exceeds maximum size") throw error;
    throw new Error("Snapshot authentication or payload validation failed");
  }
}
