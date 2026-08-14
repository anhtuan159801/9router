import { createClient } from "@supabase/supabase-js";

export function createSnapshotStore(config, clientFactory = createClient) {
  const client = clientFactory(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async load() {
      const { data, error } = await client.from("router_config_snapshots").select("instance_id,format_version,revision,ciphertext,checksum,updated_at").eq("instance_id", config.instanceId).maybeSingle();
      if (error) throw new Error(`[Remote persistence] fetch failed (${error.code || "unknown"})`);
      return data || null;
    },
    async save({ formatVersion, revision, ciphertext, checksum }) {
      const row = { instance_id: config.instanceId, format_version: formatVersion, revision, ciphertext, checksum, updated_at: new Date().toISOString() };
      const { error } = await client.from("router_config_snapshots").upsert(row, { onConflict: "instance_id" });
      if (error) throw new Error(`[Remote persistence] upload failed (${error.code || "unknown"})`);
      return row;
    },
  };
}
