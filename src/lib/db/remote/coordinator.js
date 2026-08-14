import { readRemoteConfig } from "./config.js";
import { decryptSnapshot, encryptSnapshot } from "./crypto.js";
import { CONFIG_KV_SCOPES, exportConfigSnapshot, importConfigSnapshot, isConfigMutation, SNAPSHOT_FORMAT_VERSION } from "./snapshot.js";
import { createSnapshotStore } from "./store.js";

const DEFAULT_DEBOUNCE_MS = 750;
const MAX_RETRY_MS = 30_000;

export async function enableRemotePersistence(adapter, options = {}) {
  const config = options.config === undefined ? readRemoteConfig() : options.config;
  if (!config) return adapter;
  const store = options.store || createSnapshotStore(config);
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const remote = await store.load();
  let revision = 0;
  if (remote) {
    if (remote.format_version !== SNAPSHOT_FORMAT_VERSION) throw new Error("[Remote persistence] unsupported remote snapshot format");
    if (!Number.isSafeInteger(Number(remote.revision)) || Number(remote.revision) < 1) {
      throw new Error("[Remote persistence] invalid remote snapshot revision");
    }
    const payload = decryptSnapshot(remote.ciphertext, remote.checksum, config.encryptionKey);
    importConfigSnapshot(adapter, payload);
    revision = Number(remote.revision);
    console.log(`[Remote persistence] restored configuration revision ${revision}`);
  } else {
    const encrypted = encryptSnapshot(exportConfigSnapshot(adapter), config.encryptionKey);
    revision = 1;
    await store.save({ formatVersion: SNAPSHOT_FORMAT_VERSION, revision, ...encrypted });
    console.log("[Remote persistence] created initial encrypted configuration snapshot");
  }

  let dirty = false;
  let timer = null;
  let uploading = null;
  let retryMs = 1_000;
  let closed = false;

  function schedule(delay = debounceMs) {
    dirty = true;
    if (closed || timer) return;
    timer = setTimeout(() => { timer = null; void flush(); }, delay);
    if (typeof timer.unref === "function") timer.unref();
  }

  async function uploadLoop() {
    while (dirty && !closed) {
      dirty = false;
      try {
        const encrypted = encryptSnapshot(exportConfigSnapshot(adapter), config.encryptionKey);
        const nextRevision = revision + 1;
        await store.save({ formatVersion: SNAPSHOT_FORMAT_VERSION, revision: nextRevision, ...encrypted });
        revision = nextRevision;
        retryMs = 1_000;
      } catch (error) {
        dirty = true;
        console.error(`[Remote persistence] upload failed; last valid revision retained: ${error.message}`);
        schedule(retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        break;
      }
    }
  }

  function flush() {
    if (!uploading) uploading = uploadLoop().finally(() => { uploading = null; if (dirty && !timer && !closed) schedule(); });
    return uploading;
  }

  const wrapper = Object.create(adapter);
  wrapper.run = (sql, params = []) => {
    const result = adapter.run(sql, params);
    if (isConfigMutation(sql) && (String(sql).toLowerCase().includes(" kv") ? CONFIG_KV_SCOPES.some((scope) => params.includes(scope) || String(sql).includes(`'${scope}'`)) : true)) schedule();
    return result;
  };
  wrapper.exec = (sql) => { const result = adapter.exec(sql); if (isConfigMutation(sql)) schedule(); return result; };
  wrapper.flushRemotePersistence = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    await flush();
  };
  wrapper.close = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    // Flush before marking the coordinator closed; uploadLoop intentionally
    // refuses to start after closure. A failed upload leaves the last valid
    // remote revision intact and is already logged by uploadLoop.
    if (dirty || uploading) await flush();
    closed = true;
    if (timer) { clearTimeout(timer); timer = null; }
    return adapter.close?.();
  };
  return wrapper;
}
