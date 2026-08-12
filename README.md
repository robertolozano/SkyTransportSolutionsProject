# Compliance Radar

**Sky Innovation project — AUTOMATE track**

A compliance deadline engine for a DOT permitting back office. It derives every filing
deadline from the underlying regulations, models how those filings block each other, and
reduces the result to the number that actually matters: **the date each truck stops being
legal to operate.**

---

## The problem

Sky Transport Solutions is not a trucking company. It is the outsourced paperwork
department for roughly 18,000 motor carriers — about 25 people holding other people's
compliance obligations.

Three things make that hard:

**Deadlines are derived, not delivered.** Nobody sends a bill. The biennial federal update
is due on a date encoded in the carrier's own USDOT number — the last digit selects the
month, the second-to-last selects the year parity. A driver's medical certificate expires
whenever their examiner decided. Emissions compliance keys off the vehicle's registration
cycle. Every date has to be computed, per carrier, per truck, per driver, and remembered a
year later.

**Obligations are chained.** The IRS returns a stamped Schedule 1 after the heavy vehicle
tax is filed, and the DMV will not renew apportioned registration without it. California
places a registration hold on any vehicle that has not cleared emissions. So a missed
emissions appointment in August is not an emissions problem — it is a plate renewal
failure in November, and nothing on a normal calendar shows that.

**The failure mode is asymmetric.** Filing on time earns a $199–$399 annual membership.
Missing one item parks a truck that was earning roughly $800 a day, and the client blames
the service they hired to remember.

## What this does

Enter a carrier, and the system derives every obligation from the rules, builds the
dependency graph between them, and surfaces the out-of-service date with its root cause
traced back through the chain.

For the demo account `Altamont Freight Systems` (DOT 3421569, unit 101):

```
CARB Clean Truck Check  ──▶  Form 2290 (HVUT)  ──▶  IRP Plate Renewal
     Aug 17                       Aug 31                 Sep 16
                                                    OUT OF SERVICE
```

The plate expires September 16. But the binding constraint is the emissions check five days
from now — miss that, and the renewal behind it cannot complete regardless of what the
calendar says. That account is also on the Silver plan, which does not cover plate renewals
at all.

---

## Running it

Requires Docker and Node 20+.

```bash
# 1. Start Postgres
docker run --name compliance-radar-db \
  -e POSTGRES_PASSWORD=radar -e POSTGRES_USER=radar -e POSTGRES_DB=compliance_radar \
  -p 5433:5432 -d postgres:16

# 2. Install and set up
npm install
echo 'DATABASE_URL="postgresql://radar:radar@localhost:5433/compliance_radar?schema=public"' > .env
npx prisma migrate deploy
npx prisma generate

# 3. Seed, derive, and backfill filing history
npm run db:seed        # 40 carriers, 143 trucks, 152 drivers
npm run db:recompute   # runs the rules engine, materializes ~1,150 obligations
npm run db:backfill    # marks past filings complete, leaves a realistic minority missed

# 4. Run
npm run dev            # http://localhost:3000
npm test               # 45 unit tests
```

`npm run db:reset` does all of steps 2–3 from scratch.

---

## Architecture

```
   ┌──────────────────────────────────────────────┐
   │  Next.js App Router (React Server Components)│   pages query the DB directly
   └───────────────────────┬──────────────────────┘
                           │
   ┌───────────────────────┴──────────────────────┐
   │  src/server/  queries.ts · materialize.ts    │   Prisma + 5 raw SQL aggregates
   └───────────────────────┬──────────────────────┘
                           │
   ┌───────────────────────┴──────────────────────┐
   │  src/rules/   PURE — no I/O, no framework    │   the actual asset
   │  7 rules · dependency graph · pricing        │
   └───────────────────────┬──────────────────────┘
                           │
   ┌───────────────────────┴──────────────────────┐
   │  PostgreSQL 16 via Prisma — 10 tables        │
   └──────────────────────────────────────────────┘
```

### The rules engine is pure

`src/rules/` imports nothing — no Prisma, no React, no HTTP. Every rule is a function from
plain facts to dated obligations, with `asOf` injected rather than read from the clock.

That has three consequences worth pointing at:

1. **It is testable without fixtures.** 45 tests run in 400ms with no database.
2. **It runs anywhere.** The what-if simulator on the truck page executes the *same*
   `computeOutOfService` the server used to materialize the data — in the browser,
   unchanged.
3. **It is auditable.** Compliance logic lives in one place with citations attached,
   rather than dissolved into query conditions and UI branches.

### Obligations are materialized, not computed per request

The engine derives; a separate materializer persists. `recompute()` runs the rules over
every carrier and writes the results to the `Obligation` table along with instance-level
blocker edges.

This is a deliberate choice:

- **Aggregation.** The dashboard, seasonal wave, and coverage-gap reports are `GROUP BY`
  queries. Deriving in application code per page load does not survive 18,000 carriers.
- **Audit trail.** A persisted obligation records what was derived, from which rule, when.
  "Why did we think this was due?" has an answer.
- **Honest deployment shape.** A real system recomputes nightly and on record change.

Completion state survives recomputation — obligations are matched on a natural key of
`(rule, subject, period)`, so filing history is never lost when the engine reruns.

### Prisma and raw SQL, each where it fits

Prisma handles schema, migrations, and relational reads. Five aggregates are hand-written
SQL in `src/server/queries.ts`, because they are genuinely aggregate work:

| Query | Why SQL |
|---|---|
| `getWorkQueue` | ranks open obligations against fleet-level revenue and downstream blocking counts |
| `getBookSummary` | five CTEs over the whole book in one round trip |
| `getCarrierRisk` | `MIN(...) FILTER (WHERE type IN ...)` for the per-carrier out-of-service date |
| `getCoverageGaps` | `ARRAY_AGG` of uncovered types with a tier-difference revenue calculation |
| `getMonthlyVolume` | `date_trunc` rollup with per-type `COUNT(*) FILTER` |

### The dependency graph is data

Gate edges (`HVUT_FORM_2290 → IRP_RENEWAL`) are declared on the rules and projected into
the `ObligationGate` table at seed time. One source of truth, but queryable from SQL — and
the graph can never drift from the engine that produces the obligations.

---

## What is implemented

**7 rules**, each with a source citation and an explicit verification marker:

| Rule | Scope | Derivation |
|---|---|---|
| MCS-150 biennial update | carrier | month from last digit of USDOT number, year from parity of second-to-last |
| IFTA quarterly return | carrier | last day of month following quarter close, weekend rollover |
| Form 2290 (HVUT) | truck | July–June tax period, due Aug 31, ≥55,000 lbs |
| CARB Clean Truck Check | truck | 30 days before plate expiry, plus mid-cycle |
| IRP plate renewal | truck | plate expiry, 90-day renewal window |
| UCR registration | carrier | opens Oct 1, due Dec 31 |
| Medical certificate | driver | read from the certificate, not assumed |

**9 pages** — dashboard work queue, client book, carrier detail, truck detail with the
dependency chain and what-if simulator, deadline browser with filters, rules library,
coverage gaps, seasonal calendar, and a forward-running requirement advisor.

## What is not implemented

Stated plainly here and on the `/rules` page in the app, because a compliance tool that
hides its own uncertainty is worse than one that admits it:

- **CARB testing cadence needs review.** The gating relationship to DMV registration is
  well established and correctly modelled. The *frequency* is uncertain — the program
  phased in from annual toward twice-yearly, and the applicable schedule depends on vehicle
  type and reporting year. Marked `NEEDS_REVIEW` in the rule metadata.
- **Plate staggering is read, not derived.** Expiry comes from the credential record rather
  than each base jurisdiction's schedule. Also marked `NEEDS_REVIEW`.
- **No holiday calendars.** Weekend rollover only.
- **No fee amounts.** Every rule produces a deadline; none produce dollars owed. Fuel tax
  apportionment and fee brackets are out of scope.
- **No partial-period proration** for vehicles first used mid-year.
- **Synthetic data.** 40 carriers generated with a fixed-seed PRNG. No live FMCSA lookup.

## Demo path

1. **`/dashboard`** — the risk strip, and the asymmetry callout: trucks about to be parked
   at ~$800/day against $199–$399 memberships.
2. **`/clients`** — the whole book sorted by out-of-service date. Open *Altamont Freight
   Systems*.
3. **`/trucks/…` unit 101** — the headline date, then the chain: emissions → tax → plate.
   Drag the what-if slider until the chain breaks and the cards turn red.
4. **`/rules`** — where the dates came from, with citations, and what still needs review.
5. **`/opportunities`** — the same computation read as revenue.
6. **`/onboarding`** — the engine run forward. Toggle "crossing state lines" off and watch
   half the requirements disappear and the price drop from $1,200 to $975.

---

## Layout

```
prisma/
  schema.prisma        10 tables
  seed.ts              deterministic generator + hand-tuned failure cases
  recompute.ts         materializer CLI
  backfill.ts          historical filing records
src/
  rules/               PURE — the asset
    types.ts           contracts, tier coverage
    dates.ts           UTC calendar arithmetic
    mcs150.ts ifta.ts hvut2290.ts carbCtc.ts irpRenewal.ts ucr.ts medicalCard.ts
    graph.ts           dependency edges, out-of-service assessment
    requirements.ts    the engine run forward
    pricing.ts         tier coverage and revenue
    *.test.ts          45 tests
  server/
    db.ts              Prisma singleton
    queries.ts         Prisma reads + 5 raw SQL aggregates
    materialize.ts     engine → database
    assess.ts          persisted rows → pure graph module
  components/          AppShell, UI primitives, dependency chain, what-if
  app/                 9 routes
```
