import { createClient } from "@supabase/supabase-js";

function describeRemoteError(error) {
  const chain = [];
  const seen = new Set();
  for (let current = error; current != null && !seen.has(current); current = current?.cause) {
    chain.push(current);
    if (typeof current === "object" || typeof current === "function") seen.add(current);
    else break;
  }

  const root = chain[0];
  const code = chain.find((entry) => entry && typeof entry === "object" && entry.code)?.code;
  const name = root?.name && root.name !== "Error" ? root.name : null;
  const message = root?.message || (typeof root === "string" ? root : null);
  const causeMessage = chain
    .slice(1)
    .map((entry) => entry?.message)
    .reverse()
    .find((cause) => cause && (!message || (!message.includes(cause) && !cause.includes(message))));
  // postgrest-js serializes fetch failures into a plain error object and puts
  // the native fetch cause in `details` instead of preserving it as `cause`.
  // Keep only that summary line; the rest of `details` can contain a stack.
  const serializedCause = chain
    .map((entry) => entry?.details)
    .find((value) => typeof value === "string" && /(?:^|\n)\s*Caused by:/i.test(value))
    ?.match(/(?:^|\n)\s*Caused by:\s*([^\r\n]+)/i)?.[1];
  const deepestCause = causeMessage || serializedCause;
  const details = [code, name, message, deepestCause]
    .filter((value) => value !== null && value !== undefined && String(value).trim())
    .map((value) => String(value).trim());
  return [...new Set(details)].join(": ") || "no error details returned";
}

function persistenceError(operation, error) {
  return new Error(`[Remote persistence] ${operation} failed (${describeRemoteError(error)})`, { cause: error });
}

export function createSnapshotStore(config, clientFactory = createClient) {
  const client = clientFactory(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async load() {
      const { data, error } = await client.from("router_config_snapshots").select("instance_id,format_version,revision,ciphertext,checksum,updated_at").eq("instance_id", config.instanceId).maybeSingle();
      if (error) throw persistenceError("fetch", error);
      return data || null;
    },
    async save({ formatVersion, revision, ciphertext, checksum }) {
      const row = { instance_id: config.instanceId, format_version: formatVersion, revision, ciphertext, checksum, updated_at: new Date().toISOString() };
      const { error } = await client.from("router_config_snapshots").upsert(row, { onConflict: "instance_id" });
      if (error) throw persistenceError("upload", error);
      return row;
    },
  };
}
