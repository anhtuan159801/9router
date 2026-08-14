# Encrypted Supabase configuration persistence

This optional mode keeps SQLite as 9Router's runtime database and stores an application-encrypted configuration snapshot in Supabase. It supports one writable Koyeb or Render instance only.

Persisted data includes provider/OAuth credentials, endpoint API keys, settings, combos, aliases, custom and disabled models, pricing overrides, provider nodes, and proxy pools. Usage history, daily aggregates, and request-detail logs remain local and disposable.

## 1. Create the Supabase table

Run `supabase/migrations/20260801_router_config_snapshots.sql` in the Supabase SQL editor. The table has RLS enabled and grants access only to the elevated server role.

Generate a separate encryption key and back it up in a password manager:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Losing this key makes existing snapshots unrecoverable.

## 2. Deploy on Koyeb

Configure Koyeb to build this repository using the custom Dockerfile path `Dockerfile.supabase`. The plain `Dockerfile` also builds from source, so either works; `Dockerfile.supabase` is kept for deployments that historically referenced it.

Set these Koyeb secrets/environment variables:

```text
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_SYNC_ENCRYPTION_KEY=<base64 key generated above>
SUPABASE_SYNC_INSTANCE_ID=default
```

`SUPABASE_SERVICE_ROLE_KEY` is supported as a legacy replacement for `SUPABASE_SECRET_KEY`. Never use a `NEXT_PUBLIC_` prefix for any of these values. Render uses the same environment contract.

If Supabase is empty, the first startup seeds it from the current local database. If a snapshot exists, it is authoritative and is restored before database-backed requests can run. To migrate existing local configuration, start once with the existing data directory and an empty snapshot table.

## Failure and rollback behavior

With all sync variables absent, original local-only behavior is unchanged. Partial configuration or any fetch, authentication, schema, checksum, decryption, or restore failure stops startup. Runtime upload errors retain the last valid revision and retry; logs use the `[Remote persistence]` prefix without printing secrets or snapshot contents.

To disable synchronization, preserve a safe local database copy, remove all Supabase sync variables, and redeploy. Remote data is not deleted. Encryption-key rotation is manual: retain a trusted local database, remove or rename the old snapshot row, deploy with the new key, and seed a new snapshot.

## Updating from upstream

Custom runtime code is isolated under `src/lib/db/remote/`. The only upstream integration seam is the dynamic import/call immediately after `runMigrationOnce()` in `src/lib/db/driver.js`. After merging upstream, verify that hook still executes after migrations and before `state.instance` is assigned. Provider-specific JSON fields round-trip without fixed Supabase column mappings.
