# Cellar-Hands Billing Portal - Complete Guide

Welcome to the Cellar-Hands Billing Portal documentation. This guide covers everything you need to get started with the billing system and use it effectively.

The Cellar-Hands Billing Portal connects to your InnoVint cellar management system and automates the billing process for winery services. It pulls action data from InnoVint, matches each action to your configured rate rules, and produces detailed billing reports and invoices.

### What the portal handles

- **Action-based billing** — Filters, analyses, additions, custom labor, bottling, barrel operations, and more
- **Inventory-based billing** — Bulk wine storage (per gallon) and empty barrel/tirage storage (per barrel)
- **Fruit intake contracts** — Multi-month installment billing for fruit processing
- **Billable add-ons** — Manual one-off charges
- **Invoice generation** — Professional PDF invoices per customer
- **Excel exports** — Multi-sheet workbooks with full billing detail

### User Roles

| Role | Access |
|------|--------|
| **Admin** | Full access to all features, plus user management |
| **Team Member** | Full access to billing, rate table, settings, customers, invoices |
| **Cellar** | Can view and add billable add-ons only |

---

# 1. Getting Started

## Logging In

Navigate to the portal URL and sign in with your email and password. If you don't have an account, ask your Admin to create one and provide you with a password setup link.

## First-Time Setup

Before running your first billing cycle, complete these steps in order:

### 1.1 Configure API Credentials

Go to **Settings** and enter your InnoVint API credentials:

- **Access Token** — Your InnoVint API access token
- **Winery ID** — Your InnoVint winery identifier (numeric)

These credentials allow the portal to pull action and inventory data from InnoVint.

### 1.2 Set Up Customers

Go to **Customers** and map your InnoVint owner names to billing codes:

- **Owner Name** — The owner name as it appears in InnoVint (e.g., "VIV")
- **Code** — Short billing code (auto-uppercased)
- **Display Name** — Full name for invoices (e.g., "Vivier Wines")
- **Address, Phone, Email** — Contact details for invoices

You can also import customers from a CSV file.

### 1.3 Create Rate Rules

Go to **Rate Table** and add your billing rules. Each rule defines how a specific type of action is priced. See the [Rate Table](#3-rate-table) section for detailed instructions.

### 1.4 Run Billing

Go to **Billing**, select the month and year, and click **Run Billing**. The system will:

1. Fetch all actions from InnoVint for the selected period
2. Match each action to your rate rules
3. Calculate bulk wine storage charges
4. Calculate empty barrel/tirage storage charges
5. Present results for review

See the [Billing](#4-billing) section for details on reviewing and exporting results.

---

# 2. Settings

The Settings page configures your InnoVint API connection, storage billing parameters, and fruit intake program settings.

## InnoVint API Credentials

| Field | Description |
|-------|-------------|
| **Access Token** | Your InnoVint API access token. Stored securely. |
| **Winery ID** | Your numeric InnoVint winery identifier. |

Both fields are required before you can run billing.

## Bulk Storage Rate

The **Rate per gallon** ($/gal) is applied to bulk wine storage billing. This rate is used when calculating charges based on the 3-snapshot billing method (see [Bulk Storage](#bulk-storage)).

## Barrel Inventory Snapshots

Configure which days of the month the system takes inventory snapshots for empty barrel storage billing:

| Field | Description |
|-------|-------------|
| **Snapshot 1 Day** | Day of month for the first snapshot (1-31) |
| **Snapshot 2 Day** | Day of month for the second snapshot (1-31) |
| **Snapshot 3 Day** | Day of month for the third snapshot, or "last day of month" |

The system averages the empty barrel counts across all three snapshots to calculate the monthly storage charge.

## Fruit Intake Settings

These settings control how fruit intake contracts are calculated.

### General

| Field | Description |
|-------|-------------|
| **Action Type Key** | The InnoVint action type used for fruit intake events (default: `FRUITINTAKE`) |
| **Vintage Lookback** | How many years of vintages to query (1-5, default: 3) |
| **API Page Delay** | Seconds to wait between API pages during fetch (0-30) |
| **Default Contract Length** | Number of months for new contracts (default: 9) |

### Programs

Create multiple pricing programs for different fruit types. Each program has:

| Field | Description |
|-------|-------------|
| **Program Name** | Display name (e.g., "Program #1") |
| **Description** | Description (e.g., "Red Wine") |
| **Rate per Ton** | Price per ton of fruit ($) |

### Fees

| Field | Description |
|-------|-------------|
| **Min Processing Fee** | Minimum charge per fruit intake event ($) |
| **Small Lot Fee** | Additional fee for lots below the threshold ($) |
| **Small Lot Threshold** | Weight in tons below which the small lot fee applies |

---

# 3. Rate Table

The Rate Table defines how each InnoVint action is priced. Each row is a **rate rule** that matches a specific action type, variation, and billing unit to a dollar rate.

## Creating a Rule

Click **Add Rule** to open the rule editor. Fill in the fields below and click **Save**.

### Required Fields

| Field | Description |
|-------|-------------|
| **Action Type** | The InnoVint action type to match (e.g., `ANALYSIS`, `CUSTOM`, `ADDITION`, `FILTER`, `BOTTLE`). Select from the dropdown or type a custom value. |
| **Variation** | The subtype or name within the action type (e.g., a specific analysis panel, additive name, or custom action name). Leave blank to create a catch-all rule that matches any variation. |
| **Label** | Human-readable name shown in billing results and invoices. Auto-generated from Action Type + Variation if left blank. |
| **Billing Unit** | How the charge is calculated. See [Billing Units](#billing-units) below. |
| **Rate** | Dollar amount per billing unit. |

### Optional Fields

| Field | Description |
|-------|-------------|
| **Setup Fee** | One-time fee added per action occurrence. |
| **Setup Fee Mode** | `per_action` (default) adds the fee to each action. `spread_daily` splits one setup fee across all actions of the same type on the same day, proportional to volume. |
| **Min Dollar** | Minimum charge floor. If the calculated total is below this amount, the charge is increased to the minimum. |
| **Free First per Lot** | Waives the charge for the first occurrence of this rule per lot code. The waived row shows "(Included)" in results. |
| **Exclude All-Inclusive** | Zeros out the charge for lots tagged "all-inclusive" in InnoVint. These rows show "(All-Inclusive)" in results. |
| **Min Qty / Max Qty** | For tonnage-based rules (fruit processing). Multiple rules can cover different weight ranges with tiered pricing. |
| **Notes** | Internal notes, not shown on invoices. |
| **Enabled** | Toggle the rule on or off without deleting it. |

### Action-Type-Specific Fields

| Field | Applies To | Description |
|-------|-----------|-------------|
| **Vessel Type** | ADDITION | Filter to a specific vessel type: Tank, Barrel, Keg, Carboy, Steel Drum, Bin, or Egg. |
| **Material Rate** | ADDITION | Cost per additive unit. Added to the per-vessel charge. |
| **Analysis Source** | ANALYSIS | Filter to a specific lab source. |
| **Bottles per Case** | BOTTLE | Filter to a specific case format (e.g., 12). |
| **Exclude Tax Classes** | ADDITION | List of tax classes to bill at $0 (e.g., `FERMENTING_JUICE`, `HARD_CIDER`). |

## Billing Units

| Unit | Quantity Used |
|------|-------------|
| **per hour** | Hours extracted from the action's notes field |
| **per barrel** | Number of vessels involved |
| **per vessel** | Number of vessels involved |
| **per gallon** | Lot volume at time of action |
| **per kg** | Weight from the action |
| **per ton** | Weight from the action |
| **per case** | Case count from the action |
| **per analysis** | Count of analyses |
| **per additive unit** | Quantity of additive used |
| **per lot** | Always 1 (flat per-lot charge) |
| **flat fee** | Always 1 (fixed charge regardless of quantity) |

## Matching Priority

When the system processes an action, it searches for a matching rate rule in this order:

1. **Exact match** — Action type, variation, and any type-specific filters (vessel type, analysis source, bottles per case) all match exactly.
2. **Partial match** — Action type and variation match, but type-specific filters are blank on the rule (matches any).
3. **Catch-all** — Action type matches and the rule's variation is blank.
4. **Billable keyword** — If the action's name or notes contain the word "billable", a rule with variation `BILLABLE` is used regardless of action type.
5. **Unmatched** — No rule found. The action appears in the Audit tab for manual review.

### ADDITION Actions (4-Tier Cascade)

1. Exact additive name + exact vessel type
2. Exact additive name + any vessel type
3. Any additive name + exact vessel type
4. Any additive name + any vessel type (full catch-all)

### ANALYSIS Actions (4-Tier Cascade)

1. Exact panel name + exact analysis source
2. Exact panel name + any source
3. Any panel name + exact source
4. Any panel name + any source (full catch-all)

### BOTTLE Actions

1. Exact bottle format name + exact bottles-per-case
2. Exact bottle format name + any bottles-per-case
3. Catch-all (blank variation)

## CSV Import and Export

### Exporting

Click **Export CSV** to download all rate rules as `rate-rules.csv`. All rules are exported regardless of any active filters.

### Importing

Click **Import CSV** to upload a CSV file. After parsing, a preview of the first 10 rules is shown. Choose an import mode:

- **Merge** — Updates existing rules that match by action type + variation (case-insensitive). New rules are appended.
- **Replace All** — Discards all current rules and replaces them with the imported set.

### CSV Column Order

```
actionType, variation, label, billingUnit, rate, setupFee, minQty, maxQty,
notes, enabled, setupFeeMode, minDollar, freeFirstPerLot, excludeTaxClasses,
vesselType, analysisSource, excludeAllInclusive
```

- `enabled`: use `1`, `true`, or `yes` for enabled
- `maxQty`: leave blank for unlimited
- `excludeTaxClasses`: pipe-separated (e.g., `FERMENTING_JUICE|HARD_CIDER`)
- `freeFirstPerLot` and `excludeAllInclusive`: use `1` for true, `0` for false

---

# 4. Billing

The Billing page is where you run monthly billing, review results, and export data.

## Running Billing

1. Select the **Month** and **Year** for the billing period.
2. Click **Run Billing**.

The system runs through these stages:

1. **Fetch Actions** — Pulls all actions from InnoVint for the selected month (paginated).
2. **Process Actions** — Normalizes raw API data into billable rows, extracting hours, volumes, and quantities.
3. **Enrich Volumes** — For CUSTOM actions billed per gallon, looks up each lot's actual volume at the time of the action.
4. **Rate Matching** — Matches each action to a rate rule and calculates charges. Unmatched actions go to the Audit tab.
5. **Bulk Inventory** — Calculates bulk wine storage charges using three inventory snapshots.
6. **Barrel Inventory** — Calculates empty barrel and tirage storage charges using three vessel inventory snapshots.

A progress bar and log show real-time status as each stage completes.

## Results Overview

After billing completes, five summary cards are displayed:

| Card | Description |
|------|-------------|
| **Total Actions** | Number of actions fetched and processed |
| **Total Billed** | Sum of all charges across matched actions |
| **Unmatched** | Number of actions that didn't match any rate rule |
| **BULK Lots** | Number of owners with bulk wine storage charges |
| **Barrel Owners** | Number of owners with barrel/tirage storage charges |

## Results Tabs

### Actions

The main billing results table. Each row shows:

- **Action Type** — The InnoVint action type
- **Action ID** — Links to the action in InnoVint
- **Lot Codes** — Associated lot codes
- **Performer** — Who performed the action
- **Date** — When the action occurred
- **Owner Code** — The customer billing code
- **Analysis/Notes** — Analysis panel name, custom action name, or notes
- **Hours** — Hours extracted from notes (for per-hour billing)
- **Qty** — Quantity used for billing (volume, cases, vessels, etc.)
- **Rate** — The matched rate per unit
- **Setup Fee** — One-time fee applied
- **Total** — Final charge for this action

**Color coding:**
- **Green** — Matched to a rate rule
- **Yellow** — Unmatched (no rate rule found)
- **Italic** — Rectified from the Audit tab

### Bulk Inventory

Bulk wine storage charges per owner. See [Bulk Storage](#bulk-storage) below.

### Barrel Inventory

Empty barrel and tirage storage charges per owner. See [Barrel Storage](#barrel-storage) below.

### Audit

Actions that didn't match any rate rule. See [Rectifying Unmatched Actions](#rectifying-unmatched-actions) below.

### Summary

A per-customer summary showing total charges across all categories.

## Bulk Storage

Bulk wine storage uses a **3-snapshot** method to determine monthly charges:

1. **Snapshot 1** — Day 1 of the month
2. **Snapshot 2** — Day 15 of the month
3. **Snapshot 3** — Last day of the month

For each owner:

- **Billing Volume** = the maximum volume across all three snapshots
- **Proration** = 100% if the owner had wine on day 15, or 50% if only on day 1 or the last day
- **Total** = Billing Volume x Rate per Gallon x Proration

The rate per gallon is configured in [Settings](#bulk-storage-rate).

Only lots tagged "BULK" or "Bulk" in InnoVint are included.

## Barrel Storage

Empty barrel storage uses a **3-snapshot average** to determine monthly charges. The snapshot days are configurable in [Settings](#barrel-inventory-snapshots).

For each snapshot, the system exports the full vessel inventory from InnoVint and counts empty vessels (those with zero or no fill level) by owner.

Three vessel categories are tracked separately:

| Category | Vessels Counted |
|----------|----------------|
| **Barrels** | Empty BARREL vessels (excluding puncheon style) |
| **Puncheons** | Empty BARREL vessels with a puncheon style |
| **Tirage** | Empty TIRAGE vessels |

For each owner and category:

- **Average** = (Snapshot 1 + Snapshot 2 + Snapshot 3) / 3
- **Charge** = Average x Rate + Setup Fee

Each category uses its own rate rule from the Rate Table. Rules are identified by labels containing "EMPTY", "BARREL", and "STORAGE", with "PUNCHEON" or "TIRAGE" distinguishing the subcategories.

## Rectifying Unmatched Actions

The **Audit** tab shows actions that didn't match any rate rule. You can manually assign a rule to each:

1. Select a **rate rule** from the "Assign Rule" dropdown.
2. The **Total** field auto-calculates based on the rule's rate and setup fee. You can override it manually.
3. Optionally change the **Owner Code** if it was misidentified.
4. Click **Rectify**.

Rectified actions replace the original unmatched row in the Actions tab and appear in italic to indicate they were manually assigned.

## Excel Export

Click **Download Excel** to generate a multi-sheet workbook (`cc-billing-cellar-hands.xlsx`):

| Sheet | Contents |
|-------|----------|
| **ACTIONS** | All action-based billing rows with color coding |
| **Bulk Inventory** | Bulk wine storage charges per owner |
| **Barrel Inventory** | Barrel/tirage storage charges per owner |
| **Audit Report** | Unmatched actions with reasons |
| **Fruit Intake** | Fruit intake records (if any exist) |
| **Installment Schedule** | Monthly installment matrix (if fruit records exist) |

---

# 5. Fruit Intake

The Fruit Intake page manages crush contracts — tracking fruit received, calculating installment payments, and generating billing schedules.

## Fetching Fruit Intake Data

1. Go to the **Fruit Intake** tab.
2. Click **Run Fruit Intake Fetch**.

The system pulls data from two InnoVint endpoints:

- **Fruit Intake Report** — All fruit intake events across configured vintages
- **Lots Modular** — Lot details including tags and owner information

The **Vintage Lookback** setting (in [Settings](#fruit-intake-settings)) controls how many years of data to fetch. For example, a lookback of 3 fetches the current year and 2 prior years.

New records are merged with existing data — re-running the fetch adds new events without overwriting previously saved records. Duplicates are detected by event ID and by the combination of lot code + vintage + date.

## Records Table

Each fruit intake record shows:

| Column | Description |
|--------|-------------|
| **Vintage** | Harvest year |
| **Date** | Date the fruit was received |
| **Code** | Customer billing code |
| **Lot Code** | InnoVint lot code |
| **Varietal** | Grape variety |
| **Color** | Red or white |
| **Weight** | Fruit weight in tons |
| **Total** | Total contract cost |
| **Program** | Pricing program assigned |
| **Contract** | Contract length in months |
| **Rate/ton** | Price per ton |
| **Sm Lot** | Small lot fee (if applicable) |
| **Monthly** | Monthly installment amount |
| **Remaining** | Outstanding balance |

### Row Colors

- **Red** — Owner is unmapped (no customer record). Go to [Customers](#7-customers) to add the mapping.
- **Yellow** — Contract not fully configured (missing contract length or rate).
- **Green** — Fully configured and ready for billing.

### Filtering

Use the filters at the top of the page:

- **Customer** — Filter by owner code
- **Vintage** — Filter by harvest year
- **Color** — Filter by red or white
- **Balance** — Show all records, only those with a remaining balance, or only completed contracts

## Editing Records

Four fields can be edited directly in the table:

| Field | How to Edit |
|-------|-------------|
| **Program** | Select from the dropdown. Automatically updates Rate/ton from the program settings. |
| **Contract** | Select the contract length from the dropdown. |
| **Rate/ton** | Click the value, type a new amount, press Enter to save. |
| **Sm Lot** | Click the value, type a new amount, press Enter to save. |

All changes are saved immediately and trigger a recalculation of Total, Monthly, and Remaining.

## How Contracts are Calculated

### Contract Start

All contracts start in **November of the vintage year**. For example, 2025 vintage fruit starts billing in November 2025.

### Total Cost

```
Total = max(Weight x Rate/ton, Minimum Processing Fee) + Small Lot Fee
```

- **Minimum Processing Fee** is configured in [Settings](#fruit-intake-settings). If the weight x rate is below this threshold, the minimum fee is charged instead.
- **Small Lot Fee** is added automatically when the weight is below the **Small Lot Threshold** (also in Settings). It can be overridden per record.

### Monthly Amount

```
Monthly = Total / Contract Length (months)
```

### Installments

One installment is generated per month for the full contract length, starting from the contract start month (November of the vintage year).

## Programs

Programs are pricing tiers configured in [Settings](#programs). Each program has a name, description, and rate per ton. When you assign a program to a record, its Rate/ton is automatically applied.

Example programs:
- **Program #1** — Red Wine ($250/ton)
- **Program #2** — White Wine ($200/ton)

## Installment Schedule

The second tab shows a **monthly installment matrix**:

- **Rows** — One per fruit record (Owner Code + Lot Code)
- **Columns** — One per calendar month across all active contracts
- **Subtotal** — Bottom row shows the total due per month

Click any month column header to **copy** that month's billing data (owner code and amount, tab-separated) to your clipboard for pasting into a spreadsheet.

## CSV Export

Click **Export CSV** to download all fruit intake records with full details including weigh tag number, owner name, and all calculated fields.

---

# 6. Billable Add-Ons

Billable add-ons are manual one-off charges that appear on a customer's Winery Services invoice. Use them for charges that fall outside the standard action-based billing rules — for example, special services, equipment fees, or corrections.

## Adding an Add-On

1. Go to the **Billable Add-Ons** tab.
2. Click **Add Row**.
3. Fill in the fields:

| Field | Description |
|-------|-------------|
| **Date** | The date for the charge (defaults to today). Determines which billing month the charge appears in. |
| **Item** | Select from the list of enabled rate rules. This sets the rate and billing unit automatically. |
| **Quantity** | Number of units (supports up to 3 decimal places). |
| **Owner** | The customer billing code to charge. |
| **Notes** | Optional description or reference. |

The **Rate**, **Unit**, and **Total** are calculated automatically from the selected rule and quantity.

4. Click **Save** to create the add-on.

## Viewing Add-Ons

All add-ons are listed in a table showing the date, item, quantity, owner, rate, total, and notes. Add-ons are grouped by the billing month of their date.

## Deleting Add-Ons

- **Single delete** — Click the X button on any row to remove it.
- **Bulk delete** — Click the "Clear {Month}" button to remove all add-ons for a specific month.

Deletion is available to Admin and Team Member roles only. Cellar users can view and create add-ons but cannot delete them.

## How Add-Ons Appear on Invoices

Add-ons are included on the customer's **Winery Services** invoice for the billing month that matches the add-on's date. They appear as line items alongside action-based charges, barrel storage, and bulk storage.

---

# 7. Customers

The Customers page maps InnoVint owner names to billing codes and stores contact information used on invoices.

## Customer Fields

| Field | Description |
|-------|-------------|
| **Owner Name** | The owner name exactly as it appears in InnoVint (e.g., "VIV"). This is the lookup key used to match actions to customers. |
| **Code** | Short billing code (e.g., "VIV"). Automatically uppercased. Used throughout the system as the internal customer identifier. |
| **Display Name** | Full customer name shown on invoices (e.g., "Vivier Wines"). |
| **Address** | Mailing address, printed on PDF invoices. |
| **Phone** | Phone number, printed on PDF invoices. |
| **Email** | Email address, printed on PDF invoices. |

## Managing Customers

### Adding a Customer

Click **Add Row** to add a blank row. Fill in the Owner Name, Code, and Display Name at minimum, then click **Save Customers**.

### Editing a Customer

All fields are editable directly in the table. Make your changes and click **Save Customers** to persist.

### Removing a Customer

Click the **X** button on a row to remove it, then click **Save Customers**.

### Unmapped Owners

If the system encounters an owner from InnoVint that doesn't have a customer mapping, it is automatically added as a row with the Owner Name pre-filled but no Code. These unmapped rows appear highlighted in amber. Fill in the Code and Display Name to complete the mapping.

On the Fruit Intake page, records from unmapped owners appear with a red background and "UNMAPPED" as the code.

## CSV Import

Click **Import CSV** to upload a file. The expected format is:

```
Owner Name, Code, Display Name, Address, Phone, Email
```

- One customer per line
- Fields are comma-separated
- Surrounding quotes are stripped automatically
- Imported customers are appended to the existing list (not replaced)
- Click **Save Customers** after importing to persist

Accepts `.csv` and `.txt` files.

---

# 8. Invoices

The Invoices page generates professional PDF invoices from your billing results.

## Prerequisites

Before generating invoices:

1. **Run billing** for the desired month on the Billing tab.
2. **Set up customers** with display names and contact details on the Customers tab.

## Generating Invoices

1. Go to the **Invoices** tab.
2. Select the **Month** and **Year**.
3. Optionally enter **Excluded Customers** (comma-separated billing codes) to skip specific customers.
4. Click **Generate Preview**.

The preview shows a table of all customers with their:

- **Winery Services** total (actions + storage + add-ons)
- **Fruit Intake** total (crush installments due this month)
- **Combined Total**

Summary cards show the grand total, number of invoices, and number of customers.

5. Click **Download All Invoices (ZIP)** to generate and download all PDFs in a single ZIP file.

## Invoice Types

Each customer may receive up to two invoices per billing month:

### Winery Services Invoice

Covers all charges from the billing run:

- **Action-based charges** — Grouped by rate rule label (e.g., all "Filter" actions on one line)
- **Barrel storage** — Empty barrel and tirage storage charges
- **Bulk wine storage** — Per-gallon storage charges
- **Billable add-ons** — Manual charges entered on the Add-Ons tab

A **3% merchant fee** is added to the subtotal.

### Fruit Intake Invoice

Covers the crush installment due for the billing month. Each lot with an active contract that has a payment due in the selected month appears as a line item showing:

- Lot code
- Fruit weight (tons)
- Full contract total
- This month's installment amount

The invoice title indicates the installment number (e.g., "3rd Crush Installment") and subtitle shows progress (e.g., "3 OF 9 INSTALLMENTS 2025 CRUSH").

A **3% merchant fee** is also added.

## Invoice Format

### Invoice Number

Format: `{YEAR}-{MM}-{CODE}-{SEQ}`

Example: `2026-03-VIV-001` (first invoice for customer VIV in March 2026). If the customer has both a Winery Services and Fruit Intake invoice, the sequence increments (e.g., `-001` and `-002`).

### Issue Date

Set to the last day of the billing month.

### PDF Layout

Each invoice includes:

- Company header with logo, name, and contact information
- Invoice number and issue date
- Customer name and contact details
- Itemized line items with quantity, price, and amount
- Subtotal
- 3% merchant fee
- **Total Due** (highlighted)

### File Naming

PDFs are named: `{CustomerName}_{Invoice-Type}_{InvoiceNumber}.pdf`

The ZIP file is named: `Invoices_{Mon}-{Year}.zip` (e.g., `Invoices_Mar-2026.zip`).

---

# 9. User Management

User management is available to **Admin** users only. Access it from the **Users** tab.

## Roles

| Role | Access |
|------|--------|
| **Admin** | Full access to all features, plus user management |
| **Team Member** | Full access to billing, rate table, settings, customers, and invoices. Can create and delete billable add-ons. Cannot manage users. |
| **Cellar** | Can view and create billable add-ons only. Cannot delete add-ons or access other features. |

## Adding a User

1. Enter the user's **email address**.
2. Select a **role** (Admin, Team Member, or Cellar).
3. Click **Add User**.

A **password setup link** is generated and displayed. Copy this link and share it with the new user so they can set their password and log in.

## Managing Users

The users table shows all accounts with their email, role, creation date, and available actions.

### Changing a Role

Select a new role from the dropdown in the user's row. The change takes effect immediately.

You cannot demote your own account.

### Generating a Password Reset Link

Click **Reset Link** on a user's row to generate a new password reset link. Share this with the user if they need to reset their password.

### Deleting a User

Click **Delete** on a user's row and confirm the deletion. This removes the account from both authentication and the user database.

You cannot delete your own account.
