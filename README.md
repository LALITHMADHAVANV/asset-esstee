# Maintenance Module — Garment Factory Maintenance & Asset Management Suite

A modern, production-grade Computerized Maintenance Management System (CMMS) designed for apparel manufacturing sewing floors. Built with **Next.js 16 (App Router, React 19, TypeScript)**, **Tailwind CSS v4**, **Lucide Icons**, and **Local MongoDB** (`mongodb://127.0.0.1:27017/textech_cmms`).

---

## Key Features & Modules

### 1. Machine Entry & Asset Registry (`/dashboard/machines`)
- **Apparel Machinery Support**: Pre-configured specs for SNLS, Overlock (4-thread/5-thread), Flatlock/Interlock, Bartack, Buttonhole Indexers, and Feed-off-the-arm (FOTA) units.
- **Dynamic QR Asset Tags**: Generates high-contrast thermal printable QR tags (`@media print` optimized for Zebra/TSC thermal label printers) with machine ID, brand, model, line, and floor station.
- **Downtime & Machine Age Tracker**: Live calculation of machine age (years from purchase date) and MTBF/cumulative downtime minutes.

### 2. Spare Parts Crib & Requisitions (`/dashboard/inventory`)
- **Tool Crib Inventory**: Real-time stock counts, minimum buffer thresholds, SKU tracking, unit costs, and quick `[-]` / `[+]` bin adjustments.
- **Separated Requisition Workflows**:
  - **Critical Needs (Requires CEO Approval)**: For catastrophic breakdowns and capital-intensive components (e.g., servo driver PCBs) that halt production lines.
  - **Urgent Needs (Manager Fast-Track)**: For high-priority shift repairs (e.g., damaged loopers or broken cutters) requiring immediate line supervisor sign-off.
  - **Monthly Indent Builder**: Multi-item part list builder allowing mechanics to compile bulk monthly supply requests with dynamic item additions, quantity controls, and automated OPEX calculations.

### 3. Machine History Dossier & PPM Sign-off (`/dashboard/history`)
- **Full Dossier View**: Machine specifications, health badge, operator assignment, and chronological maintenance audit trail.
- **Key Metrics**: MTTR (Mean Time to Repair), total breakdown incidents, and total plant downtime.
- **PPM Sign-off**: One-click preventive maintenance compliance verification with date stamps and technician notes.

### 4. Mechanic Shift Calendar & Breakdown Queue (`/dashboard/calendar`)
- **7-Day Shift Strip**: Interactive date navigation with active ticket counter badges.
- **Breakdown Queue**: Live critical, warning, and pending work orders.
- **Atomic "Attend & Fix" Workflow**: Modal dialog allowing mechanics to record root cause, log downtime minutes, and select replacement parts with atomic inventory stock deduction.

### 5. Floor Asset & Line Tracker (`/dashboard/floor-tracker`)
- **Visual Factory Floor Grid**: Interactive floor overview spanning **Line 01, Line 02, Line 03, Line 04, Buffer Workshop, and Scrap Bay**.
- **Line Rebalancing**: One-click machine relocation between production lines, buffer standby, and decommissioned scrap storage with automatic relocation ledger entries.

### 6. Mobile Floor Scanner Terminal (`/scan/[id]`)
- **Direct QR Scan Target**: Mobile-first responsive view accessed by scanning machine QR codes on the shop floor.
- **Instant Actions**: Report immediate breakdown with fault category and urgency, or execute floor machine relocation.

---

## Tech Stack

- **Framework:** Next.js 16.3.5 (Turbopack, App Router)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide React
- **Backend / Database:** Local MongoDB (`mongodb` official driver)
- **QR Code Tooling:** `qrcode.react` (generation) & `html5-qrcode` (camera scanning)
- **Date Utilities:** `date-fns`

---

## Database Architecture (MongoDB Collections)

| Collection | Description | Document Identifier |
|---|---|---|
| `users` | Mechanics, Plant Managers, System Admins, CEO | `uid` / `email` |
| `machines` | Factory sewing machines across production lines | `id` (e.g. `MC-SNLS-101`) |
| `spare_parts` | Tool crib garment spare parts & consumables | `partId` (e.g. `PRT-01`) |
| `repair_tickets` | Breakdown tickets & chronological repair ledger | `id` (e.g. `WO-1091`) |
| `ppm_schedules` | Weekly, monthly, and 6-month preventive tasks | `id` (e.g. `PPM-101`) |
| `part_requisitions` | Monthly Indents, Urgent Shift Needs, Critical CEO Needs | `id` (e.g. `REQ-2026-091`) |

---

## Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/LALITHMADHAVANV/maint-assert-module.git
cd maint-assert-module
npm install
```

### 2. Configure Environment
Your local MongoDB URI is already pre-configured in `.env.local`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.ucek7vf.mongodb.net/maintanence?appName=Cluster0
MONGODB_DB_NAME=maintanence
```

Ensure your local MongoDB server is running:
```bash
# Verify MongoDB service or mongod
mongod --dbpath <data-dir>
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## License
MIT
