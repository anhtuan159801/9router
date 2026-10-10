# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

<!--
Document your project's database conventions here.

Questions to answer:
- What ORM/query library do you use?
- How are migrations managed?
- What are the naming conventions for tables/columns?
- How do you handle transactions?
-->

(To be filled by the team)

---

## Query Patterns

<!-- How should queries be written? Batch operations? -->

(To be filled by the team)

---

## Migrations

<!-- How to create and run migrations -->

(To be filled by the team)

---

## Naming Conventions

<!-- Table names, column names, index names -->

(To be filled by the team)

---

## Scenario: Remote Snapshot Initialization Failures

### 1. Scope / Trigger

- Trigger: changing the database adapter startup path or Supabase snapshot
  persistence.
- Scope: `src/lib/db/driver.js` and `src/lib/db/remote/{store,coordinator}.js`.

### 2. Signatures

- `getAdapter(): Promise<DbAdapter>` initializes and caches the process adapter.
- `createSnapshotStore(config, clientFactory).load()` returns a snapshot or
  `null` when the configured instance has no row.
- `enableRemotePersistence(adapter, options)` restores an existing snapshot or
  seeds revision 1 before returning the adapter wrapper.

### 3. Contracts

- Run local migrations before loading the remote snapshot.
- Do not publish the adapter as ready until remote restore or initial seeding
  succeeds. A fetch, authorization, schema, checksum, decryption, or restore
  failure remains fail-closed; never silently serve a possibly stale local
  configuration.
- Format store errors with available PostgREST code, error name, message, and
  the deepest distinct `cause.message`. Supabase may serialize native fetch
  causes into `error.details`; when present, include only its `Caused by:`
  summary line and omit the stack. Preserve the original error as `cause`; do
  not replace transport failures with `(unknown)` when nested details exist.
- `POST /api/auth/login` returns a caught `getSettings()` error as the HTTP
  500 response's `error` field and does not log it. Keep formatted details
  free of secrets; use the login response or UI for diagnosis instead of
  expecting that caught error in Render logs.
- If remote initialization fails, close the local adapter and clear the
  rejected initialization promise. A later request may then make a fresh
  initialization attempt.
- Runtime upload failures retain the last valid remote revision and use the
  coordinator's retry loop.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| All remote sync variables absent | Return the local adapter without creating a Supabase client. |
| Partial remote sync configuration | Fail with a configuration error before serving database-backed requests. |
| Snapshot fetch returns a PostgREST error | Fail closed and retain its code and message. |
| Snapshot fetch fails at the transport layer | Fail closed and include nested network cause details when available. |
| Login settings initialization fails | Return HTTP 500 with the safe diagnostic in `error`; the current route does not write a log entry. |
| Remote initialization fails | Close the adapter, clear the rejected promise, and allow a later request to retry. |
| Runtime upload fails | Keep the last valid revision and retry without interrupting the active adapter. |

### 5. Good / Base / Bad Cases

- Good: a DNS fetch failure reports its nested `ENOTFOUND` cause; a later
  request retries after the Supabase endpoint becomes reachable.
- Base: a valid snapshot is restored before the first database-backed request.
- Bad: return a local adapter after a failed remote fetch or keep a rejected
  promise cached for the rest of the process.

### 6. Tests Required

- Store unit test: assert a fetch error with a nested `cause.code` and
  `cause.message` keeps those details in the thrown error.
- Initialization unit test: assert a remote startup failure closes the local
  adapter and the next `getAdapter()` call starts a new initialization.
- Coordinator regression: retain the existing fail-closed assertion when
  `store.load()` rejects.

### 7. Wrong vs Correct

#### Wrong

```js
if (!state.initPromise) state.initPromise = initAdapter().then((adapter) => {
  state.instance = adapter;
  return adapter;
});
```

This leaves a rejected promise cached, so every later request fails without
retrying initialization.

#### Correct

```js
state.initPromise = initAdapter()
  .then((adapter) => { state.instance = adapter; return adapter; })
  .catch((error) => { state.initPromise = null; throw error; });
```

Close the adapter when remote initialization fails, then rethrow the original
error so the request fails closed and a later request can retry.

## Common Mistakes

<!-- Database-related mistakes your team has made -->

(To be filled by the team)
