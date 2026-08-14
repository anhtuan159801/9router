const NAMES = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SYNC_ENCRYPTION_KEY", "SUPABASE_SYNC_INSTANCE_ID"];

export function readRemoteConfig(env = process.env) {
  const present = NAMES.some((name) => Boolean(env[name]?.trim()));
  if (!present) return null;

  const url = env.SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim() || env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const encryptionKeyText = env.SUPABASE_SYNC_ENCRYPTION_KEY?.trim();
  if (!url || !secretKey || !encryptionKeyText) {
    throw new Error("[Remote persistence] SUPABASE_URL, a Supabase secret key, and SUPABASE_SYNC_ENCRYPTION_KEY must all be configured");
  }
  let parsedUrl;
  try { parsedUrl = new URL(url); } catch { throw new Error("[Remote persistence] SUPABASE_URL is invalid"); }
  if (parsedUrl.protocol !== "https:" && parsedUrl.hostname !== "localhost" && parsedUrl.hostname !== "127.0.0.1") {
    throw new Error("[Remote persistence] SUPABASE_URL must use HTTPS");
  }
  const encryptionKey = Buffer.from(encryptionKeyText, "base64");
  if (encryptionKey.length !== 32 || encryptionKey.toString("base64").replace(/=+$/, "") !== encryptionKeyText.replace(/=+$/, "")) {
    throw new Error("[Remote persistence] SUPABASE_SYNC_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  const instanceId = env.SUPABASE_SYNC_INSTANCE_ID?.trim() || "default";
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(instanceId)) throw new Error("[Remote persistence] invalid instance id");
  return { url, secretKey, encryptionKey, instanceId };
}
