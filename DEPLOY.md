# Deploying

Target: **Vercel** (the app) + **Neon** (Postgres). Both have free tiers that
comfortably hold this. Roughly 20 minutes end to end.

Anything that made local development convenient but would break on a serverless
host has already been changed — see *What had to change* at the bottom.

---

## 1. Create the database (Neon)

1. Sign up at [neon.tech](https://neon.tech) and create a project — any region near you.
2. Copy the **pooled** connection string. It looks like:

```
postgresql://USER:PASSWORD@ep-xxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
```

Use the **pooled** host (`-pooler`). A serverless function opens a connection per
invocation, and an unpooled Postgres will refuse them under any real traffic.

## 2. Load the schema and demo data

Run this **from your machine**, pointed at Neon, before the first deploy — so the
site has something to show the moment it comes up.

```bash
cd compliance-radar

export DATABASE_URL="postgresql://...-pooler...neon.tech/neondb?sslmode=require"

npx prisma migrate deploy   # creates the schema
npm run db:seed             # 40 carriers, 143 trucks, 152 drivers
npm run db:recompute        # derives ~1,150 obligations from the rules
npm run db:backfill         # marks past filings complete, leaves a few genuinely missed
npm run db:requests         # outstanding document requests
```

Deadlines are anchored relative to today, so the demo stays current whenever it
is seeded. Re-run these four scripts any time you want it to look fresh.

## 3. Deploy (Vercel)

1. Sign in at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project**, import `robertolozano/SkyTransportSolutionsProject`.
3. Set **Root Directory** to `compliance-radar`. This matters — the repository
   root is one level above the app.
4. Add an environment variable:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the same pooled Neon string |

5. **Deploy.**

Framework detection, build command, and install command are all correct by
default. `package.json` already runs `prisma generate` on install and
`prisma migrate deploy` before the build, so the schema is applied on every
deployment.

## 4. Check it came up

- `/dashboard` — the staff console
- `/start` — the public walkthrough
- `/clients` → open a carrier → **View as client** — the portal

Then exercise the loop that touches the most machinery: on the client's
**Documents** tab, *Download a sample to test*, then *Choose file* and upload it
back. If the extracted fields appear, the database, the Server Action, blob
storage, and the parser are all working.

## 5. Optional — enable vision extraction

Without this, PDFs still extract (the deterministic parser needs no credentials)
and photographs are stored and queued for manual review, which the UI states
plainly. To read photographs too, add:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key |

Redeploy. No code change.

---

## What had to change for a serverless host

**Uploaded files moved from disk into Postgres.** The original implementation
wrote to a local directory, which works in development and fails on Vercel,
where the filesystem is read-only outside a scratch directory that does not
survive the request. The failure would have landed squarely on document upload.

Bytes now live in an `UploadBlob` table. At real volume the answer is object
storage with a signed URL; at this size — documents capped at 5 MB, a handful
per carrier — a table keeps the system self-contained with nothing extra to
provision. Because `src/server/storage.ts` exposes only "give me bytes, get a
key", the swap touched that one file and nothing above it.

**Build scripts.** `postinstall` runs `prisma generate` (the client is generated,
not committed) and `build` runs `prisma migrate deploy` first, so a deployment
can never serve code that expects a column the database does not have.

---

## Troubleshooting

**Build fails on `prisma migrate deploy`** — `DATABASE_URL` is missing or wrong
in Vercel's environment variables. It is needed at build time, not just runtime.

**"Can't reach database server"** — check you used the pooled host and kept
`?sslmode=require`.

**Site loads but every page is empty** — the schema deployed but the seed did
not run. Do step 2 with `DATABASE_URL` pointed at Neon.

**Too many connections** — you are on the unpooled host. Switch to `-pooler`.

**Uploads fail with "Please send a photo or a PDF"** — the file was not
recognised by content. Files are identified by magic number rather than by the
name or the browser's declared type, so an unusual format is genuinely rejected
rather than mislabelled.
