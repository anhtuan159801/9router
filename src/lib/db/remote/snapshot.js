import { SCHEMA_VERSION, TABLES } from "../schema.js";

export const SNAPSHOT_FORMAT_VERSION = 1;
export const CONFIG_TABLES = ["settings", "providerConnections", "providerNodes", "proxyPools", "apiKeys", "combos"];
export const CONFIG_KV_SCOPES = ["modelAliases", "customModels", "mitmAlias", "pricing", "disabledModels"];

export function exportConfigSnapshot(db) {
  const tables = Object.fromEntries(CONFIG_TABLES.map((name) => [name, db.all(`SELECT * FROM ${name}`)]));
  const placeholders = CONFIG_KV_SCOPES.map(() => "?").join(", ");
  tables.kv = db.all(`SELECT * FROM kv WHERE scope IN (${placeholders})`, CONFIG_KV_SCOPES);
  return { formatVersion: SNAPSHOT_FORMAT_VERSION, createdAt: new Date().toISOString(), schemaVersion: SCHEMA_VERSION, config: { tables } };
}

function validatePayload(payload) {
  if (!payload || payload.formatVersion !== SNAPSHOT_FORMAT_VERSION || !payload.config?.tables) throw new Error("Invalid snapshot payload");
  for (const name of [...CONFIG_TABLES, "kv"]) if (!Array.isArray(payload.config.tables[name])) throw new Error(`Invalid snapshot table: ${name}`);
  for (const name of CONFIG_TABLES) {
    const allowed = new Set(Object.keys(TABLES[name].columns));
    for (const row of payload.config.tables[name]) {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Invalid row in ${name}`);
      if (!Object.keys(row).some((key) => allowed.has(key))) throw new Error(`Empty row in ${name}`);
    }
  }
  for (const row of payload.config.tables.kv) {
    if (!row || !CONFIG_KV_SCOPES.includes(row.scope) || typeof row.key !== "string" || typeof row.value !== "string") throw new Error("Invalid kv snapshot row");
  }
}

export function importConfigSnapshot(db, payload) {
  validatePayload(payload);
  db.transaction(() => {
    for (const name of CONFIG_TABLES) db.run(`DELETE FROM ${name}`);
    const placeholders = CONFIG_KV_SCOPES.map(() => "?").join(", ");
    db.run(`DELETE FROM kv WHERE scope IN (${placeholders})`, CONFIG_KV_SCOPES);
    for (const name of CONFIG_TABLES) {
      const allowed = new Set(Object.keys(TABLES[name].columns));
      for (const row of payload.config.tables[name]) {
        const columns = Object.keys(row).filter((key) => allowed.has(key));
        db.run(`INSERT INTO ${name} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, columns.map((key) => row[key]));
      }
    }
    for (const row of payload.config.tables.kv) {
      db.run("INSERT INTO kv(scope, key, value) VALUES(?, ?, ?)", [row.scope, row.key, row.value]);
    }
  });
}

export function isConfigMutation(sql) {
  const normalized = String(sql).replace(/^[\s\n]*(?:--[^\n]*\n\s*)*/g, "").toLowerCase();
  if (!/^(insert|replace|update|delete)\b/.test(normalized)) return false;
  return [...CONFIG_TABLES, "kv"].some((table) => new RegExp(`\\b${table.toLowerCase()}\\b`).test(normalized));
}
