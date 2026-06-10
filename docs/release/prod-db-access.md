# Connecting to the Leiko production database

**Project:** `leiko-prod` · ref **`kqnzxjrpnjnczhgdwdqg`** ·
`https://kqnzxjrpnjnczhgdwdqg.supabase.co`

> TL;DR: **the MCP Supabase tools and the `supabase` CLI cannot reach
> leiko-prod** — they're logged into a different account. To run real
> SQL against prod you use the **Supabase Management API** with the
> project's **Personal Access Token (PAT)**. The one method that works is
> documented below.

---

## Why the obvious paths don't work

| Path | Works? | Why |
|---|---|---|
| `mcp__supabase__execute_sql` / `list_migrations` | ❌ | The MCP server is authed to a **different** Supabase account. `kqnzxjrpnjnczhgdwdqg` is **not** in its `list_projects`, so every call targets the wrong org. |
| `supabase` CLI (`supabase db …`, `projects list`) | ❌ | Same problem — `supabase login` on this machine is a different account (orgs `yxht…` / `dbzf…`). leiko-prod isn't listed. |
| Anon key from `apps/mobile/.env.local` | ⚠️ partial | Role `anon`, **RLS-gated**. Direct PostgREST reads return only what an unauthenticated user may see (≈ nothing for vitals/tokens). Fine for client work, useless for an admin audit. |
| **Management API + PAT** | ✅ | Runs arbitrary SQL as the project owner. **This is the path.** |

## Credentials (never commit these)

- **Management API PAT** — starts with `sbp_`. Master copy in **1Password**
  ("Leiko Supabase Management PAT"). It is **not** in the repo and does
  **not** travel with a machine migration — carry it by hand.
- Export it into the shell as `LEIKO_PAT` before running anything:

  ```bash
  export LEIKO_PAT='sbp_…'        # from 1Password, per session, never in a file
  export LEIKO_REF='kqnzxjrpnjnczhgdwdqg'
  ```

The anon/publishable keys (`EXPO_PUBLIC_SUPABASE_ANON_KEY`,
`sb_publishable_…`) are public by design and live in `eas.json` /
`.env.local`; they are **not** what you use for an admin query.

## The endpoint

```
POST https://api.supabase.com/v1/projects/<ref>/database/query
  Authorization: Bearer <PAT>
  Content-Type:  application/json
  User-Agent:    leiko-claude/1.0      # REQUIRED — the API 403s a missing UA
  body:          {"query": "<SQL>"}
```

It returns a JSON array of result rows (or `{"message": "…ERROR…"}` on a
SQL error). A non-trivial `User-Agent` header is mandatory.

## The helper (preferred)

`tools/prod-sql.py` wraps the endpoint. It reads the PAT from `LEIKO_PAT`
(never hard-coded) and the SQL from stdin:

```bash
export LEIKO_PAT='sbp_…'
echo "select count(*) from push_tokens" | python3 tools/prod-sql.py
```

```bash
# multi-line SQL via heredoc
python3 tools/prod-sql.py <<'SQL'
select u.email, pt.platform, pt.last_seen_at
from push_tokens pt join auth.users u on u.id = pt.user_id
order by pt.last_seen_at desc;
SQL
```

## curl one-liner (no helper)

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/$LEIKO_REF/database/query" \
  -H "Authorization: Bearer $LEIKO_PAT" \
  -H "Content-Type: application/json" \
  -H "User-Agent: leiko-claude/1.0" \
  --data '{"query":"select now()"}'
```

## Mutations — guard them

Reads are safe. For **writes**, follow the standing ops rule (see
`plans/NEXT_SESSION_START_HERE.md` "Hard-won operational notes"): wrap the
change in a `DO $$ … $$` block that aborts on an unexpected row count, then
record the version manually in
`supabase_migrations.schema_migrations`. Never run an unguarded `UPDATE` /
`DELETE` against prod.

## Edge functions & logs

The same PAT works for the rest of the Management API — e.g. listing edge
functions or pulling logs:

```bash
curl -s "https://api.supabase.com/v1/projects/$LEIKO_REF/functions" \
  -H "Authorization: Bearer $LEIKO_PAT" -H "User-Agent: leiko-claude/1.0"
```

For CLI edge deploys (separate from the above), the documented form is
`SUPABASE_ACCESS_TOKEN=<PAT> npx supabase functions deploy <fn> \
  --project-ref kqnzxjrpnjnczhgdwdqg --use-api`.
