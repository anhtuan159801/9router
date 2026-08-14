import { describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { readRemoteConfig } from "../../src/lib/db/remote/config.js";
import { decryptSnapshot, encryptSnapshot } from "../../src/lib/db/remote/crypto.js";
import { enableRemotePersistence } from "../../src/lib/db/remote/coordinator.js";
import { exportConfigSnapshot, importConfigSnapshot, isConfigMutation } from "../../src/lib/db/remote/snapshot.js";

function memoryAdapter(seed = {}) {
  const tables = {
    settings: [], providerConnections: [], providerNodes: [], proxyPools: [], apiKeys: [], combos: [], kv: [],
    usageHistory: [{ id: 99, provider: "sentinel" }], requestDetails: [], ...structuredClone(seed),
  };
  return {
    driver: "memory",
    tables,
    all(sql, params = []) {
      const table = /from\s+(\w+)/i.exec(sql)?.[1];
      if (table === "kv" && /scope in/i.test(sql)) return tables.kv.filter((r) => params.includes(r.scope)).map((row) => structuredClone(row));
      return (tables[table] || []).map((row) => structuredClone(row));
    },
    run(sql, params = []) {
      const deleted = /delete from\s+(\w+)/i.exec(sql)?.[1];
      if (deleted) {
        if (deleted === "kv" && /scope in/i.test(sql)) tables.kv = tables.kv.filter((r) => !params.includes(r.scope));
        else tables[deleted] = [];
        return { changes: 1 };
      }
      const inserted = /insert into\s+(\w+)\s*\(([^)]+)\)/i.exec(sql);
      if (inserted) {
        const columns = inserted[2].split(",").map((v) => v.trim());
        tables[inserted[1]].push(Object.fromEntries(columns.map((column, index) => [column, params[index]])));
        return { changes: 1 };
      }
      return { changes: 0 };
    },
    exec() {},
    transaction(fn) { return fn(); },
    close() {},
  };
}

const config = { url: "https://example.supabase.co", secretKey: "secret", encryptionKey: randomBytes(32), instanceId: "default" };

describe("remote persistence configuration", () => {
  it("is disabled only when all variables are absent", () => {
    expect(readRemoteConfig({})).toBeNull();
    expect(() => readRemoteConfig({ SUPABASE_URL: "https://example.supabase.co" })).toThrow(/must all be configured/);
  });

  it("accepts a complete server-only configuration", () => {
    const key = randomBytes(32).toString("base64");
    expect(readRemoteConfig({ SUPABASE_URL: "https://example.supabase.co", SUPABASE_SECRET_KEY: "secret", SUPABASE_SYNC_ENCRYPTION_KEY: key })).toMatchObject({ instanceId: "default" });
  });
});

describe("encrypted snapshots", () => {
  it("round trips and rejects wrong keys or tampering", () => {
    const payload = { formatVersion: 1, config: { tables: {} } };
    const encrypted = encryptSnapshot(payload, config.encryptionKey);
    expect(decryptSnapshot(encrypted.ciphertext, encrypted.checksum, config.encryptionKey)).toEqual(payload);
    expect(() => decryptSnapshot(encrypted.ciphertext, encrypted.checksum, randomBytes(32))).toThrow(/authentication/);
    expect(() => decryptSnapshot(encrypted.ciphertext, `${encrypted.checksum}x`, config.encryptionKey)).toThrow(/checksum/);
    expect(() => decryptSnapshot("not base64!", encrypted.checksum, config.encryptionKey)).toThrow(/encoding/);
  });
});

describe("configuration snapshots", () => {
  it("preserves JSON data and leaves operational tables untouched", () => {
    const source = memoryAdapter({ providerConnections: [{ id: "p1", provider: "custom", authType: "api_key", data: JSON.stringify({ futureField: "kept", token: "secret" }), createdAt: "a", updatedAt: "b" }], kv: [{ scope: "disabledModels", key: "custom", value: '["x"]' }] });
    const target = memoryAdapter({ usageHistory: [{ id: 99, provider: "sentinel" }] });
    importConfigSnapshot(target, exportConfigSnapshot(source));
    expect(target.tables.providerConnections[0].data).toContain("futureField");
    expect(target.tables.kv[0].scope).toBe("disabledModels");
    expect(target.tables.usageHistory).toEqual([{ id: 99, provider: "sentinel" }]);
  });

  it("detects configuration writes but not usage writes", () => {
    expect(isConfigMutation("UPDATE providerConnections SET data = ?")).toBe(true);
    expect(isConfigMutation("INSERT INTO usageHistory(timestamp) VALUES(?)")).toBe(false);
  });
});

describe("bootstrap coordinator", () => {
  it("seeds only after a confirmed missing row", async () => {
    const db = memoryAdapter();
    const store = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue({}) };
    await enableRemotePersistence(db, { config, store, debounceMs: 1 });
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ revision: 1, formatVersion: 1 }));
  });

  it("fails closed when the remote fetch fails", async () => {
    const store = { load: vi.fn().mockRejectedValue(new Error("network")), save: vi.fn() };
    await expect(enableRemotePersistence(memoryAdapter(), { config, store })).rejects.toThrow("network");
    expect(store.save).not.toHaveBeenCalled();
  });

  it("restores an existing encrypted snapshot before returning", async () => {
    const source = memoryAdapter({ apiKeys: [{ id: "k1", key: "secret-key", name: null, machineId: null, isActive: 1, createdAt: "now" }] });
    const encrypted = encryptSnapshot(exportConfigSnapshot(source), config.encryptionKey);
    const store = { load: vi.fn().mockResolvedValue({ format_version: 1, revision: 7, ...encrypted }), save: vi.fn() };
    const target = memoryAdapter();
    await enableRemotePersistence(target, { config, store });
    expect(target.tables.apiKeys[0].key).toBe("secret-key");
    expect(store.save).not.toHaveBeenCalled();
  });

  it("fails closed on invalid remote revision metadata", async () => {
    const encrypted = encryptSnapshot(exportConfigSnapshot(memoryAdapter()), config.encryptionKey);
    const store = { load: vi.fn().mockResolvedValue({ format_version: 1, revision: 0, ...encrypted }), save: vi.fn() };
    await expect(enableRemotePersistence(memoryAdapter(), { config, store })).rejects.toThrow(/revision/);
  });

  it("uploads configuration mutations and ignores usage mutations", async () => {
    const db = memoryAdapter();
    const store = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue({}) };
    const wrapped = await enableRemotePersistence(db, { config, store, debounceMs: 60_000 });
    store.save.mockClear();
    wrapped.run("INSERT INTO usageHistory(timestamp) VALUES(?)", ["now"]);
    await wrapped.flushRemotePersistence();
    expect(store.save).not.toHaveBeenCalled();
    wrapped.run("UPDATE settings SET data = ? WHERE id = 1", ["{}"]);
    await wrapped.flushRemotePersistence();
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
  });

  it("flushes a pending configuration mutation before close", async () => {
    const db = memoryAdapter();
    const store = { load: vi.fn().mockResolvedValue(null), save: vi.fn().mockResolvedValue({}) };
    const wrapped = await enableRemotePersistence(db, { config, store, debounceMs: 60_000 });
    store.save.mockClear();
    wrapped.run("UPDATE settings SET data = ? WHERE id = 1", ["{}"]);
    await wrapped.close();
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ revision: 2 }));
  });
});
