# Company login handover

Updated 29 October 2026. Clean workspace configuration.

## Current behavior

- One login resolves an exact work email, username, employee ID, or user ID to its company. Ambiguous identifiers are rejected.
- Signed sessions select the database. Company data APIs reject unsigned requests and requests for another company. Active account status and current role are checked on each request.
- Administrators and asset managers manage users. Other users may change only their own password. Password updates cannot change roles or create accounts.
- New account identifiers are checked across companies and reserved centrally. Reservations are retained after deletion or failed creation to prevent identifier reuse; an administrator must review any reservation before releasing it.
- New QR codes include the company route. Scanning requires login and uses actual database assets; QR text cannot create a fallback asset.
- Settings and Telegram configuration are company-specific. Existing shared browser preferences are not automatically assigned to a company. Telegram tokens are saved on the server and not returned to the browser.
- Machine catalog and spare parts seed registries start clean (`[]`) for customer data provisioning.
- Clean database setup is provided in `scripts/setup-esstee.js`.

## Setup and Verification

To initialize the primary Esstee workspace with standard role accounts:
```bash
node scripts/setup-esstee.js
```

Passed automated test suites:
- `node scripts/test-login-account.cjs`
- `node scripts/test-login-session.cjs`
- `node scripts/test-company-security.cjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `npm run build -- --webpack`

## Before giving the site to customers

1. Deploy with a private random JWT_SECRET (at least 32 characters), the intended MONGODB_URI, and the registry setting documented in `.env.example`.
2. Configure company Telegram bot and chat destinations in Settings or using environment variables.
3. Sign in with real accounts for each role and check asset changes, breakdown creation/assignment/completion, inventory requests, PPM, password changes, logout, and QR scanning.
