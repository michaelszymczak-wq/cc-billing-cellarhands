# InnoVint Billing Engine

A full-stack web application that automates billing calculations for InnoVint winery management, replicating the logic of an existing Excel Office Scripts billing automation.

## Tech Stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Excel Export:** ExcelJS
- **No database** — in-memory session state + local JSON config file

## Prerequisites

- Node.js 18+ (required for native `fetch`)
- npm 7+ (required for workspaces)

## Setup

```bash
# Install all dependencies (root + backend + frontend)
npm install

# Configure your InnoVint credentials (or use the Settings UI)
# Credentials are stored in ~/.cc-billing-cellar-hands-config.json
```

## Running

```bash
# Start both backend (port 3001) and frontend (port 5173) concurrently
npm run dev
```

Open http://localhost:5173 in your browser.

## Configuration

1. Navigate to **Settings** in the sidebar
2. Enter your InnoVint **Access Token** and **Winery ID**
3. Click **Save Settings**

Settings are persisted to `~/.cc-billing-cellar-hands-config.json`.

## Usage

1. Select a **Month** and **Year**
2. Toggle which billing steps to run:
   - **Actions + Rate Mapping** (Steps 1 & 2)
   - **Bulk Inventory** (Step 3)
3. Upload a **Rate Table CSV** if running actions
4. Adjust the **Storage Matrix** rates if running bulk inventory
5. Click **Run Billing**
6. Monitor progress in the live console
7. Review results across the ACTIONS, Bulk Inventory, Audit, and Summary tabs
8. Click **Download Excel** for a 3-tab .xlsx export

## Rate Table CSV Format

| Column | Description |
|--------|-------------|
| 0 | Action Type |
| 2 | Variation / Vessel Type |
| 4 | Rate ($) |
| 5 | Quantity |
| 6 | Setup Fee ($) |

Header row is auto-detected and skipped if present.
