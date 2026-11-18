# Vercel + MongoDB Atlas deployment

Deploy the main maintenance app, not the nested `my-mongodb-app` demo.
The Git repository begins in this directory, so use Vercel Root Directory `.`
for the `esstee-asset` repository. If importing a parent repository that contains
this directory, select `Maintanence` instead.

## Atlas

1. Create an Atlas database user and copy Connect > Drivers > Node.js URI.
   Replace username/password and URL-encode special characters in credentials.
2. Allow the Vercel deployment's outbound addresses in Atlas Network Access.
   Use fixed outbound addresses where available. A `0.0.0.0/0` rule permits
   connections from anywhere and requires strong database credentials.
3. Grant the app user read/write access to `compliance_master` and each tenant
   database, including permission to create indexes.
4. Migrate existing local data with MongoDB Database Tools (`mongodump` and
   `mongorestore`), including `compliance_master` and every database referenced
   by its `companies` collection. Merely changing the URI does not migrate data.
   Each company must have `slug`, `name`, `active: true`, and `databaseName`.
   An empty Atlas cluster has no registered workspaces or existing users.
   Avoid running demo setup scripts against production: they create predictable
   sample account passwords and can overwrite existing records.

## Vercel

Import the repository, select Next.js, and keep the default build (`npm run build`)
and output settings. Add these server-only environment variables to Production
(and to Preview only if previews should access that database):

- `MONGODB_URI`: the complete Atlas connection string.
- `REGISTRY_DB_NAME`: `compliance_master` (or the migrated registry name).
- `JWT_SECRET`: a private random secret of at least 32 characters. Generate one
  locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

Never prefix these with `NEXT_PUBLIC_`. Local `.env` files are not uploaded as
Vercel environment settings. Redeploy after adding or changing variables.
`MONGODB_DB_NAME` does not select the tenant database in this application.

## Verify

Repair creation and updates now commit the ticket, spare issue and asset status in
one MongoDB transaction. Use Atlas or a replica set; a standalone MongoDB server
returns an explicit error without applying partial changes.

For the existing local Windows MongoDB 9.0 installation, preview the setup with
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/enable-local-replica-set.ps1`.
Then run the same command with `-Apply` from an Administrator PowerShell. This
backs up `mongod.cfg`, enables localhost-only single-node `rs0`, restarts the
MongoDB service and initializes replication while retaining the existing data
directory. The script restores the original config if setup fails. Existing local
MongoDB URIs continue to work; production should use an Atlas connection string.

Repair expenses use spare quantities and recorded unit prices only. Labour is
ignored for existing repairs and is never charged for new repairs. An existing
repair without recorded spare prices falls back to its catalog price; no default
price is invented. Existing database records are not bulk rewritten.

Asset Entry has **Import Assets**. Inventory and the Spare Inward dialog have
**Import Spare Inward**. Both accept `.xlsx` and `.csv`, provide downloadable
templates, and preview up to 500 rows (5 MB). Replace the template example row
with actual records. Asset imports add new IDs without overwriting existing
assets. Inward imports add received quantities to stock and can create new
spares when SKU, name and unit cost are supplied. Invalid rows prevent the entire
batch from saving. Repeated requests for the same import do not receive stock
twice. Asset imports require administrator access; inward imports require stores
or administrator access. Imports also require a transaction-capable database.

Phone QR links now open a public ticket-only form. Operators can book a pending
breakdown without signing in; the limited public endpoint does not expose staff,
repair history, stock, or asset costs. Successful bookings show a popup and try to
close the tab. Phone browsers that block automatic closing show `/scan/booked`
instead, with no login redirect. Failed saves leave the form open for retry.
Booking retries do not create duplicate tickets. Public bookings also require a
transaction-capable database.

Run `node scripts/test-repair-regressions.cjs` for client regressions and
`node scripts/test-repair-integration.cjs` for isolated transaction tests. The
integration test starts its own temporary MongoDB replica set and never connects
to the factory database. Set `MONGOD_BINARY` for a different installation path.

Run `npm run build` before deployment. The build uses Webpack because the local
Turbopack CSS worker crashes in this environment. After deployment, open `/login`, confirm
that registered workspaces load, sign in with an existing migrated account, and
verify an asset loads and a permitted change persists after refreshing.
If workspaces are missing, check the registry migration and database grants.
If connection times out, check the Atlas network rules and cluster availability.
