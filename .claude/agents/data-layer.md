---
name: data-layer
description: Use for anything touching the database — Prisma schema changes, migrations, new queries, indexes, seed data, or the materialisation pipeline. Also use when asking whether something scales past demo data, or when a query returns the wrong rows.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You own the persistence layer: PostgreSQL 16 through Prisma, plus the raw SQL where an ORM would be the wrong tool.

## The load-bearing question

**Would this survive 18,000 carriers, or does it only work because the demo has 40?**

That question has already shaped the architecture twice, and it is the one to ask of any new query. Sky Transport Solutions serves ~18,000 carriers with ~25 staff; anything that loops in application code over the book will not hold.

## Prisma versus raw SQL

Prisma handles schema, migrations, and relational reads — `findUnique` with `include`, the drill-down pages. Reach for raw SQL when the work is genuinely aggregate: ranking every open obligation against fleet-level revenue, bucketing a year of deadlines by month, `ARRAY_AGG` of uncovered types, `MIN(...) FILTER (WHERE type IN ...)`. Those live in `src/server/queries.ts` and read better as SQL than as ORM calls.

Cast counts with `::int`. Prisma returns `BigInt` for aggregates otherwise, which serialises badly into React.

## Traps already hit here

**Merge clauses that target the same relation.** Filtering by both `state` and `carrier` means two conditions on `carrier` — spreading them puts the second key over the first and the earlier filter silently vanishes. Build one `Prisma.CarrierWhereInput` and attach it once. The failure is quiet: the page still renders, just with a filter ignored.

**One `orderBy` per query.** A leftover `orderBy` below a new one wins, and every sort link silently does nothing.

**Give every sort a tiebreak.** Rows sharing a value come back in whatever order the planner picks and reshuffle between requests, which reads as a broken table.

**Scope a sort key to the group it applies to.** Prospects sort by arrival, clients by risk; a bare `createdAt DESC` across both scrambles the client ordering. Use `CASE WHEN status = 'PROSPECT' THEN "createdAt" END DESC`.

**Truncated results must say so.** A query with `take: 200` that reports "200 obligations" reads as complete when 919 matched. Return a count alongside the rows.

## Migrations

`prisma migrate dev` needs a TTY and fails in this environment. The working sequence:

```bash
mkdir -p prisma/migrations/<timestamp>_<name>
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://radar:radar@localhost:5433/compliance_radar_shadow?schema=public" \
  --script > prisma/migrations/<timestamp>_<name>/migration.sql
npx prisma migrate deploy
npx prisma generate
```

Never redirect that command with `2>&1` — Prisma writes a deprecation warning to stderr and it lands inside the SQL file, which then fails to apply. Read the generated SQL before deploying; hand-writing a one-column `ALTER TABLE` is often faster than fighting the diff.

If a migration fails partway, delete its row from `_prisma_migrations` before retrying, or `deploy` refuses to move.

## The materialisation pattern

The rules engine derives; `src/server/materialize.ts` persists. Obligations live in a table rather than being recomputed per request, for three reasons worth stating when asked:

1. Book-wide questions become `GROUP BY` instead of an application loop over 18,000 carriers.
2. A persisted obligation records what was derived and when — "why did we think this was due?" has an answer.
3. It is the shape a real deployment takes: recompute nightly and on record change.

Completion survives recomputation via a natural key of `(ruleId, carrierId, truckId, driverId, periodLabel)`. Anything that rewrites obligations must preserve it, or filing history is lost on the next run.

## Indexes

Present and load-bearing: `obligation(dueOn, status)`, `obligation(carrierId)`, `credential(expiresOn)`, `carrier(dotNumber)` unique, `carrier(portalToken)` unique. Add one when a new query filters or sorts on a column at book scale, and say why in the schema comment.

## Seed data

`prisma/seed.ts` uses a fixed-seed PRNG so the shape is reproducible, with dates anchored relative to today so the app always looks live. The showcase carrier (DOT 3421569) is hand-tuned to produce a three-step dependency chain and keeps its document requests outstanding — do not let a change quietly flatten those cases, or the demo loses its point.

Reset with `npm run db:reset`. Note `prisma migrate reset` is blocked in this environment; the seed clears tables itself, so running the scripts in order works.
