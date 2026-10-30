# Esstee and ASSET feature alignment

Reference checkout: `D:/Maintenance-Module` (ASSET).

Restored in Esstee:

- Asset Log ledger, Active/Idle controls, scanning, batch selection, movement history, reassignment, editing and adding machines.
- Availability reports on the plant and supervisor dashboards, linked to the ledger.
- Matching ASSET navigation and Asset Log route access.
- Zone, custom zone, floor line and station controls, including saving placement metadata.

Retained from Esstee: serial-number fields, its company identity and registry,
MongoDB connection configuration, existing datasets, and the imported-data,
mobile-navigation and mechanic work-timer fixes. ASSET's company rename,
credentials and seed data are not copied. The ASSET checkout is read only.

Verification:

```sh
node scripts/check-asset-parity.cjs D:/Maintenance-Module
node scripts/test-imported-text.cjs
node scripts/test-repair-workflow.cjs
npm run build
```

The comparison checks route/module presence, exported symbols, rendered feature
components and navigation across the source trees. It does not assert identical
source code or replace testing authenticated pages against the deployed database.

After deploying the new commit to the Esstee Vercel project, verify Asset Log
filters, an authorized machine status change, location editing, mechanic
start/stop/resume/completion, mobile navigation, and history using Esstee accounts.
