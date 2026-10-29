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

Run `npm run build` before deployment. The build uses Webpack because the local
Turbopack CSS worker crashes in this environment. After deployment, open `/login`, confirm
that registered workspaces load, sign in with an existing migrated account, and
verify an asset loads and a permitted change persists after refreshing.
If workspaces are missing, check the registry migration and database grants.
If connection times out, check the Atlas network rules and cluster availability.
