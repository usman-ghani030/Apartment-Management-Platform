# Manual Test Guide - Unit Enhancements

## Prerequisites
- Backend running at http://localhost:4000 (via Docker)
- Frontend running at http://localhost:3000
- Database seeded with at least one society, building, and unit
- Test credentials: `admin@sunrise.com` / `admin123`

---

## Test 1: Bedroom Type on Unit

### Steps
1. Log in as admin (`admin@sunrise.com` / `admin123`)
2. Navigate to **Dashboard → Buildings** and create a building if none exists (e.g., "Test Building")
3. Navigate to **Dashboard → Units** → Click **Add Unit**
4. Fill in:
   - Building: "Test Building"
   - Unit Number: "101"
   - Floor: 1
   - Type: Owner Occupied
   - **Bedroom Type: 2 Bedrooms** (select from dropdown)
5. Click **Create Unit**
6. Verify: Unit "101" appears in the list with "2 Bedrooms" shown in the unit info

### Expected Result
- The bedroom type is displayed in the unit list below the unit number
- Format: "Owner Occupied · 2 Bedrooms"

---

## Test 2: Primary Contact Fields

### Steps
1. Navigate to **Dashboard → Units** → Click **Add Unit**
2. Fill in:
   - Building: "Test Building"
   - Unit Number: "201"
   - Floor: 2
   - Type: Vacant
   - Bedroom Type: 1 Bedroom
   - **Primary Contact Name: "John Doe"**
   - **Primary Contact Email: "john@example.com"**
   - **Primary Contact Phone: "+1234567890"**
3. Click **Create Unit**
4. Verify: Unit "201" appears in the list

### Expected Result
- Unit list shows "📋 John Doe (not linked)" as the occupant info
- The "(not linked)" indicator clearly shows this is not a real account

---

## Test 3: Edit Unit with New Fields

### Steps
1. In the Units list, find unit "101" and click the **Edit** (pencil) icon
2. Change the Bedroom Type from "2 Bedrooms" to "3 Bedrooms"
3. Click **Update Unit**
4. Verify the change in the list

### Expected Result
- Unit "101" now shows "3 Bedrooms" instead of "2 Bedrooms"

---

## Test 4: Building Drill-Down

### Steps
1. Navigate to **Dashboard → Buildings**
2. Click on the building name/card (not the edit button)
3. Verify: Building detail page loads

### Expected Result
- URL changes to `/dashboard/admin/buildings/{building-id}`
- Page shows building name and unit count
- Units are grouped by floor (Floor 2 above Floor 1)
- Each unit shows:
  - Unit number
  - Type (Owner Occupied, Rented, Vacant)
  - Bedroom type (if set)
  - Occupant info (linked resident name or primary contact with "(not linked)" indicator)

---

## Test 5: Unit Detail Page

### Steps
1. From the building detail page, click on unit "101"
2. OR navigate to **Dashboard → Units** and click on unit "101"
3. Verify: Unit detail page loads

### Expected Result
- URL changes to `/dashboard/admin/units/{unit-id}`
- Page shows three sections:

#### Unit Details Card
- Unit Number: 101
- Type: Owner Occupied
- Bedroom Type: 3 Bedrooms
- Floor: 1
- Building: Test Building (clickable link)

#### Occupant Information
- If unit has linked resident(s): Shows green "Linked to Account" badge
  - Displays resident name, email, and role
- If unit has only primary contact: Shows yellow "Not yet linked to an account" badge
  - Displays contact name, email, phone
  - Shows "Invite as Resident" button (if email exists)
- If unit has neither: Shows "No contact information on file"

#### Recent Tickets (if any)
- Shows last 5 tickets with title, date, and status badge

---

## Test 6: Invite from Unit Detail

### Steps
1. Go to unit "201" detail page (the one with primary contact John Doe)
2. Click **Invite as Resident** button

### Expected Result
- Navigates to memberships page with pre-filled invite form:
  - Email: john@example.com
  - Name: John Doe
  - Unit: 201

---

## Test 7: Unit List Occupant Display

### Steps
1. Navigate to **Dashboard → Units**
2. Review the unit list

### Expected Result
- Units with linked residents show: "👤 Resident Name · X resident(s)"
- Units with only primary contact show: "📋 Contact Name (not linked)"
- Units with no occupant show: "🏠 Vacant"

---

## Test 8: Empty State Handling

### Steps
1. Navigate to a building with no units (or create one)
2. Navigate to a unit with no occupant info
3. Navigate to a unit with no tickets

### Expected Result
- Building with no units: Shows "No units in this building yet" message
- Unit with no occupant: Shows "No contact information on file"
- Unit with no tickets: Recent Tickets section is hidden (not shown as empty)

---

## Test 9: Form Validation

### Steps
1. Try to create a unit without selecting a building
2. Try to create a unit without entering a unit number
3. Try to enter an invalid email in primary contact email field

### Expected Result
- Building and Unit Number are required fields (form won't submit)
- Email validation prevents invalid emails (HTML5 validation)

---

## Test 10: API Verification (Optional - for technical testing)

### Steps
```bash
# Get unit list
curl -H "x-access-token: YOUR_TOKEN" http://localhost:4000/api/v1/units

# Get unit detail
curl -H "x-access-token: YOUR_TOKEN" http://localhost:4000/api/v1/units/UNIT_ID

# Get building detail
curl -H "x-access-token: YOUR_TOKEN" http://localhost:4000/api/v1/buildings/BUILDING_ID
```

### Expected Result
- Unit list includes: `bedroomType`, `primaryContactName`, `occupantName`, `hasLinkedResident`
- Unit detail includes: all unit fields + `members[]` + `recentTickets[]`
- Building detail includes: `units[]` with occupant info

---

## Test 11: Resident Detail Page

### Steps
1. Navigate to **Dashboard → Directory**
2. Click on any resident name/card
3. Verify: Resident detail page loads

### Expected Result
- URL changes to `/dashboard/admin/directory/{userId}`
- Page shows three sections:

#### Profile Card
- Name, Email, Role (with badge), Joined date

#### Unit Information
- Unit number, Building name (clickable link to building detail), Floor, Bedroom type
- "View Unit Details →" link to unit detail page
- If no unit assigned: Shows "No unit assigned"

#### Recent Tickets
- Shows last 5 tickets with title, category, date, and status badge
- Empty state: "No tickets yet"

#### Recent Invoices (if unit assigned)
- Shows last 5 invoices with title, invoice number, amount, due date, and status badge
- Empty state: "No invoices yet"

#### Stats Cards
- Total Tickets count
- Open Tickets count (yellow)
- Recent Invoices count

---

## Test 12: Resident Detail Navigation

### Steps
1. From resident detail, click on the building name
2. Click back to return to resident detail
3. Click "View Unit Details →"
4. Click back to return to resident detail
5. Click back arrow to return to directory list

### Expected Result
- All navigation works correctly
- Building name links to building detail page
- Unit details link to unit detail page
- Back arrow returns to directory list

---

## Regression Checks

### Ensure Existing Features Still Work
1. **Create/Edit/Delete Building** - unchanged, still works
2. **Create/Edit/Delete Unit** - works with new optional fields
3. **Unit list pagination** - not affected (units still listed)
4. **Resident invite flow** - still works, unit detail has quick-invite
5. **Ticket creation** - still works with unit selection
6. **Invoice creation** - still works with unit selection

---

## Browser Compatibility
- Test in Chrome (primary)
- Verify responsive layout on mobile viewport
- Check that modals work correctly on smaller screens

---

## Issues to Report
If any of the following occur, report back:
- Unit form doesn't show bedroom type dropdown
- Building/unit detail page shows error
- Occupant info shows incorrectly (linked vs not linked)
- "Invite as Resident" button doesn't pre-fill the form
- Any TypeScript errors in browser console
