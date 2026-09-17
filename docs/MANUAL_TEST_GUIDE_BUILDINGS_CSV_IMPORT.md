# Manual Test Guide - Buildings CSV Import

**Feature:** admin-only bulk import of buildings from a CSV file, on the admin **Buildings** page. Same 4-step modal as the Units import (Upload -> Preview -> Importing -> Done), plus a downloadable sample CSV.

---

## Prerequisites
- Backend running at http://localhost:4000 (via Docker)
- Frontend running at http://localhost:3000
- Test credentials: `admin@sunrise.com` / `admin123`
- A spreadsheet app (Excel / Google Sheets / any text editor)
- **Note:** if the backend runs in Docker on Windows, restart the container after a code change (`docker restart apartment-backend`) - file-watch events do not propagate through the Docker Desktop mount

---

## Test 1: Sample CSV downloads

### Steps
1. Log in as admin (`admin@sunrise.com` / `admin123`)
2. Navigate to **Dashboard → Buildings**
3. Click **Import CSV** (next to "Add Building")
4. Click **Download sample CSV**
5. Open the downloaded `sample-buildings-import.csv`

### Expected Result
- One column only: header `Building Name`, followed by example rows (Tower A / Tower B / Tower C)
- No validation error is shown in the modal

---

## Test 2: Happy path import

### Steps
1. Open the sample CSV (or make your own: header `Building Name`, one name per row)
2. Add two names that do **not** already exist, e.g. `Test Tower 1` and `Test Tower 2`
3. Back in the modal: **Choose file** → select your CSV → **Validate CSV**
4. Check the preview cards: green "Will create" should show **2**
5. Click **Confirm Import (2 buildings)**
6. When "Import Complete" appears, click **Done**

### Expected Result
- Preview shows 2 to create, 0 skipped, 0 errors
- Confirm creates both buildings and the list refreshes automatically
- Both new buildings appear in the Buildings list without a manual reload

---

## Test 3: Duplicate handling (idempotency)

### Steps
1. Click **Import CSV** again
2. Choose the **same** file from Test 2 → **Validate CSV**

### Expected Result
- Both rows land in "Skipped (duplicates)" with "Building already exists"
- The Confirm button is disabled (nothing left to create)

---

## Test 4: Duplicates inside the same file

### Steps
1. Create a CSV with header `Building Name` and rows: `Repeat Tower`, `Repeat Tower`
2. **Choose file** → **Validate CSV**

### Expected Result
- 1 to create, 1 skipped with "Duplicate row in this file"
- The first occurrence is the one that gets created

---

## Test 5: Row validation errors

### Steps
1. Create a CSV with header `Building Name` and rows:
   - a normal name
   - a blank row (empty name)
   - a name longer than 100 characters
2. **Choose file** → **Validate CSV**

### Expected Result
- The valid row shows as "Will create"
- The blank row and the too-long row appear as red **Errors** with a per-row reason
- Import is still possible for the valid rows (errors do not silently pass)

---

## Test 6: Role restriction

### Steps
1. Log out, log in as a resident (`resident@sunrise.com` / `resident123`)
2. Look for a **Buildings** page and an **Import CSV** button in the sidebar

### Expected Result
- No Buildings page and no import UI for a resident
- If called directly, the API returns `403 FORBIDDEN` for all three endpoints (`validate`, `confirm`, `sample-csv`)

---

## Test 7: Audit trail

### Steps
1. Log in as admin → **Dashboard → Audit Log**
2. Filter/search for building creations from your Test 2 import

### Expected Result
- One `BUILDING_CREATED` entry per imported building
- One `CSV_IMPORT_COMPLETED` summary entry for the import run

---

## Cleanup
Delete the test buildings you created (`Test Tower 1`, `Test Tower 2`, `Repeat Tower`) from the Buildings page after testing.
