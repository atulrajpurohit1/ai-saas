# AegisLead — Software Testing Checklist

**How to use this file**

1. Go through each item below and try it in the app.
2. If it works, tick the box: change `[ ]` to `[x]`.
3. If something is wrong, write it in the **Issues Found** section at the bottom.
4. Later we will fix the issues one by one.

**Tip:** Test as different kinds of users (owner, staff, client, guard, vendor, platform admin) so you see what each one is allowed to do.

---

## 1. Login & Accounts

- [x] Sign up a new company account
- [x] Verify email (check the verification email arrives and the link works)
- [x] Log in with correct password
- [x] Log in with wrong password (should be rejected)
- [x] Forgot / reset password
- [x] Log out
- [x] Stay logged in after refresh / come back later
- [x] A normal user cannot open admin-only pages

## 2. Settings & Company Profile

- [x] Open Settings page
- [x] Change company name
- [x] Upload / change logo (branding)
- [ ] Add a team member (Team page → "Add user": name, email, password, role, branch)
- [ ] The new user can sign in with the email and password you set
- [ ] The new user only sees what their role allows
- [ ] Change a user's role (owner / manager / staff)
- [ ] Remove a user
- [ ] Check roles & permissions actually limit what each user can do

## 3. Billing & Plans

- [ ] See the current plan
- [ ] Upgrade / change plan
- [ ] Enter card and complete a test payment (Stripe)
- [ ] Payment success shows the right plan
- [ ] Payment failure is handled nicely (no crash)
- [ ] Cancel / downgrade plan
- [ ] Free / Trial plan limits are enforced (e.g. AI off on Trial)
- [ ] Invoices for the subscription are correct

## 4. Leads & Sales (CRM)

- [ ] Create a new lead
- [ ] Edit a lead
- [ ] Delete a lead
- [ ] Move a lead through stages / pipeline
- [ ] Create a deal
- [ ] Assign a lead/deal to a team member
- [ ] Prospect search works
- [ ] Sales Accelerator features work
- [ ] Sales calls / call transcription records correctly

## 5. Clients & Client Portal

- [ ] Add a new client
- [ ] Edit client details
- [ ] Delete a client
- [ ] Client receives login / invite
- [ ] Client can log in to the client portal
- [ ] Client sees only their own data (not other clients')
- [ ] Client compliance info shows correctly

## 6. Proposals, RFP & Rate Cards

- [ ] Create a proposal
- [ ] Send a proposal to a client
- [ ] Client can view / accept a proposal
- [ ] Create an RFP
- [ ] Create / edit a rate card
- [ ] Prices calculate correctly

## 7. Guards & Guard Portal

- [ ] Add a new guard
- [ ] Edit guard details
- [ ] Guard can log in to the guard portal
- [ ] Guard sees only their own shifts/info
- [ ] Guard compliance / documents upload works

## 8. Sites, Shifts & Scheduling

- [ ] Add a site
- [ ] Assign guards to a site
- [ ] Create a shift
- [ ] Edit / cancel a shift
- [ ] Patrol check-ins work
- [ ] Timesheets record hours correctly
- [ ] Approve / reject a timesheet

## 9. Incidents & Emergency Alerts

- [ ] Report a new incident
- [ ] Attach photos / notes to an incident
- [ ] Incident status updates (open → resolved)
- [ ] Emergency alert is sent / received

## 10. Invoices & Finance

- [ ] Create an invoice
- [ ] Send an invoice to a client
- [ ] Mark invoice as paid
- [ ] Raise an invoice dispute
- [ ] Resolve a dispute
- [ ] Finance / reports totals are correct

## 11. Vendors & Vendor Portal

- [ ] Add a vendor
- [ ] Vendor can log in to vendor portal
- [ ] Vendor sees only their own data

## 12. Documents, Notes & Activities

- [ ] Upload a document
- [ ] Download / view a document
- [ ] Add a note to a record
- [ ] Activity history shows the right actions

## 13. AI Features

- [ ] AI insights load and make sense
- [ ] AI governance / monitoring pages work
- [ ] AI is turned OFF on plans that shouldn't have it
- [ ] AI does not crash on empty data

## 14. Integrations & API

- [ ] Connect a CRM / integration
- [ ] Create an API key
- [ ] API key works for a request
- [ ] Revoke an API key (old key stops working)
- [ ] Webhooks fire correctly
- [ ] API docs page loads

## 15. Reports & Dashboard

- [ ] Main dashboard loads with real numbers
- [ ] Charts show correct data
- [ ] Reports can be filtered by date
- [ ] Export a report (PDF / CSV)

## 16. Platform Admin (Super Admin)

- [ ] Platform admin logs in (separate from normal accounts)
- [ ] See the list of all company tenants
- [ ] Create a tenant
- [ ] Suspend / delete a tenant
- [ ] Platform admin cannot be reached by a normal tenant user
- [ ] Audit log shows admin actions

## 17. General / Whole App

- [ ] Every page loads without errors
- [ ] No broken links or buttons
- [ ] Works on mobile screen size
- [ ] Forms show clear error messages when something is wrong
- [ ] Nothing loads too slowly
- [ ] Emails (system emails) actually arrive

---

## Issues Found

1. I created a new accout , and by deault it has no plan which is good. But when i gave this account the access of Trial Plan (No AI) from the super-admin, in my dashboard, it shows Aegislead Complete Plan.
   If i give it Lead gen/ guard / operation plan, it shows properly but for Trial and Complete plan -- it shows Complete in billing page .

Also in the super-admin, it shows Comped instead of which plan was given to the tenant, so remove the comped , and put the plan name like Trial / Operations '/ Complete. etc. Not comped.

**FIXED.** The cause: the plan name was being worked out backwards from which
modules a tenant had. Trial and Complete unlock the same three modules, so Trial
always came out as "Complete". The granted plan is now recorded when you grant
it, and that is what gets shown.

Please re-test:

- Grant Trial → the tenant's own Plan page says "AegisLead Trial Plan", not Complete
- Grant Complete → says "AegisLead Complete"
- Grant Lead Gen / Guard / Operations → still correct
- Super-admin tenant list → the badge shows the plan name (Trial, Operations,
  Complete...) instead of "Comped"
- Old tenants comped before this change are relabelled automatically

2. The Role page is too much confusing for a non developer user. It has too many selective options for different roles the user is neither going to read and understand. So make it super simple, anoption to add user, give role , assign branch, email and pass of invited user.

**FIXED.** There was no way to add a user at all before — the page could only
give roles to people who were somehow already in the account. Signing up always
created a brand-new company, so a colleague could never join yours.

The page is now called **Team**:

- "Add user" button → one form: name, email, password, role, branch
- Each role has a plain-language description ("Can do everything, including
  billing and adding users")
- A list of everyone who can sign in
- The ~100 permission checkboxes are now collapsed under "Advanced: what each
  role can do" — still there if you need a custom role, out of the way if you don't

Please re-test:

- Add a user, then sign in as them with the email/password you set
- They see only what their role allows
- Adding a user with an email that already exists gives a clear error
- A non-owner cannot create a Super Admin

3. **[Roles / lockout]** A user can be demoted out of all admin access with no
   way back — found while testing issue 2.

   What happens: assigning a user any non-"Super Admin" role switches off their
   Super Admin status and overwrites their role. If the account owner does this
   to themselves (or their last admin), they lose `users.assign_roles` and
   `users.manage` and can no longer fix it from inside the app — the account is
   locked out of its own user/role management.

   This is how the first test account ended up unable to add users: its owner
   had been switched to "Branch Admin" at some point during testing.

   To fix later:
   - Stop "Assign role" from removing the last person who can manage roles/users
   - Warn before demoting a Super Admin
   - Consider making "assign role" ADD a role rather than REPLACE the user's
     identity + super-admin flag
   - Give the platform super-admin console a way to restore a tenant owner's
     Super Admin (recovery path from outside the tenant)

4. In the roles, i can remove myself from the super admin and that caused the lockoout here. So remove the option of deleting the person with the email the tenant created with. For example - i created nayansuthar969@gmail.com , it is admin. No one should be able to remove the user with this role.

**FIXED.** Each tenant now has a permanent **owner** — the email the account was
created with. The owner:

- Cannot have their Super Admin role removed (the × is gone for them, and the
  server refuses it)
- Cannot be assigned a lesser role (demotion is blocked)
- Is marked with an "Owner" badge on the Team page
  Existing accounts were backfilled to their founding user automatically.

Please re-test:

- Owner shows an "Owner" badge; their Super Admin role has no remove ×
- The owner is not offered in "Give someone another role"

5. [RBAC — roles see the wrong pages; Finance can create branches; simplify roles]

**FIXED.** Three parts:

(a) Roles now show only their own pages. The bug: the sidebar showed a link if
you had ANY one of its permissions, and "Sales Accelerator"/"Sales Calls" were
tied to `ai.view`, which Finance has — so they wrongly appeared. They now
require Leads/Deals access, which Finance does not have.

(b) The "Create Branch" / activate buttons are gated on branch-management
rights (admin only). Finance no longer sees them, and the Branches page itself
is now view-gated.

(c) The roles are replaced with a simpler, job-shaped set (you picked this):

- **Super Admin** — the owner; everything incl. billing, users, branches
- **Manager** — runs the business (sales + field + invoicing); NOT billing,
  users, branches, integrations
- **Sales** — leads, deals, proposals, RFP, vendors, prospect search, AI sales
- **Operations** — sites, guards, patrols, incidents, reports, shifts, timesheets
- **Finance** — invoices, disputes, rate cards, finance reports (NOT branches,
  NOT the company's own subscription billing)
- **Guard / Client** — portal roles, unchanged
  Old roles (Branch Admin → Manager, Scheduler/Supervisor → Operations) are
  migrated automatically, so anyone on them moves to the new role on next login.

Please re-test:

- Create a Finance user → they see only Invoices, Disputes, Rate Cards, Finance
  (+ Clients/Sites view). No Branches, no Sales Accelerator/Calls, no Billing/Plan.
- Create a Sales user → only the Generation pages.
- Create an Operations user → only the field/scheduling pages.
- No role except Super Admin can create a branch.

5. When i created a new user with the Finance role on a branch , and logged in with his credentials, i see tyhese options.
   Branches
   Sites
   Client Insurance
   Sales Accelerator
   Sales Calls
   Your Plan
   Search Credits
   Billing

In the Branches page, i see option to create the branch which the finance person should not get. Only super admin can create the branch.

The finance person should only get the related page access. And this is not just about the finance, every role should have proper relevant access to pages and modules.

Use you mind here.

Also, remove the existing complex roles and add simple understandable roles with proper role based access controls.

6. While creating a guard, after entering details, i clicked the add guard button 2 times, and the same guard added 2 times. This issue may be at many places in the whole site wherever we have add button. SO this is an issue also. Also give an option to delete the guard while keeping the deativate guard.

**FIXED.**
- Double-submit: the "Add Guard" button now disables itself (with a spinner)
  while saving, and the submit is ignored if one is already in flight — so a
  double-click can no longer create two guards.
- Delete: guards now have a **Delete** button (red trash icon) alongside
  Deactivate. Delete is for duplicates/mistakes and asks for confirmation.
  Safety: the server refuses to delete a guard who has any real history
  (shifts, timesheets, incidents, invoices) — those must be Deactivated so
  their records are never silently wiped.

Note on "may be at many places": I fixed the guard form (the one you hit). The
same double-submit pattern likely exists on other add forms — flag any you find
and I'll apply the same guard. (A site-wide sweep can be a follow-up.)

Please re-test:
- Double-click "Add Guard" → only one guard is created.
- Delete a freshly-added (historyless) guard → it's removed.
- Try to delete a guard with shifts/timesheets → clear "deactivate instead" message.

7. IN Guard Compliance, there are option to add documents about the guard, but there is a column - Status, that says Valid on adding any doc. Because we arent vverifying it anywhere so it should not be valid, instad it should be ADDED. So there will be only 2 status. - Missing , Added. Do the same with the card also. Instead of valid, it should say Added.

**FIXED.** Guard compliance now has only two statuses: **Added** (a document
exists) and **Missing** (none yet). The old Valid / Expiring Soon / Expired
labels are gone for guards, because nothing verifies those documents — calling
an unverified upload "Valid" overstated it. The status badges, the filter tabs,
and the summary cards all use Added/Missing now.

(Note: Client Insurance keeps its expiry-based statuses, since those dates are
actually tracked there — this change is guard compliance only.)

Please re-test:
- Add a guard document → its status shows "Added", not "Valid".
- A document type with nothing uploaded shows "Missing".
- The summary cards at the top show Total / Added / Missing.


8. WHen i signed in as a guard, and send an emergency alert, on admin panel, idk where the alert is send.

When i created shift, i got created 2 times also.

**FIXED.**
- Emergency alerts had a backend admin API but no screen and no nav link, so
  the alert appeared to go nowhere. There is now an **Emergency Alerts** page
  (Guard section of the sidebar, gated on `incidents.view`) that lists every
  alert with the guard, location (with a map link), status and time, and lets a
  reviewer Acknowledge and Resolve. It polls every 15s so a new alert surfaces
  without a manual refresh. (The admin is now also emailed — see issue 17.)
- Duplicate shift on double-click: the Create Shift button now disables while
  saving and the handler ignores a second submit while one is in flight, so a
  double-click creates one shift.

Please re-test:
- Trigger an alert as a guard → it appears on the admin Emergency Alerts page.
- Double-click Create Shift → only one shift is created.

9. at the invoice page, this text comes in yellow color woth the same background color, hence its diffucult to read the text. Fix it . (No site is linked to selected client.
Choose a site below, then generate the invoice once it appears in the Site field.
)

**FIXED.** That notice used pale amber text on a pale amber background, which
is invisible in light mode. It now uses the app's semantic warning colours
(`text-warning` on `bg-warning-wash`), which have proper contrast in both light
and dark themes.

Please re-test:
- Pick a client with no linked site → the "No site is linked..." notice is
  clearly readable.

10. There is no option to create/add client i can find. 

**FIXED.** The Client Management page (`/clients`) already had everything — Add
New Client, edit, and create a portal login — but there was no sidebar link to
it (only "Client Insurance" was linked), so it couldn't be found. Added a
**Clients** link in the Workspace section of the sidebar.

Please re-test:
- Sidebar → Workspace → Clients → "Add New Client" works.

11. In the shifts, where  i assign the guards i get an error  - This action needs 5 credits, but your account has 0. Purchase more credits to continue.. But i can still continue. So remove this error. There should not be any credits required to assign guards to site

**FIXED.** Opening the assign-guards screen fired an AI "explanation" of the
(rule-based) guard recommendations, which was metered as a 5-credit feature — so
a tenant at 0 credits got a 402 on a screen that has nothing to do with AI. The
actual assign action used a separate non-AI path, which is why you could still
continue. The explanation is now a free enrichment: it still only runs when the
plan includes AI (Trial plans fall back to the plain rule-based sentence), but it
never charges credits and never blocks assignment.

Please re-test:
- Open assign-guards with 0 credits → recommendations load, no credit error.
- Assigning a guard to a shift/site never asks for credits.

12. When the guards reports an incident, and in the Add photo sectiion, there should be camera options also along with adding photo from gallery. Also when i upload from gallery, i get internal server error.

**FIXED.**
- Camera + gallery: the photo step now has two buttons — **Take photo** (opens
  the camera) and **From gallery** (opens the photo library / files). Before,
  the single input forced the camera on mobile and hid the gallery option.
- Gallery upload failures: two likely causes addressed.
  (1) Phone galleries often send an image/video with no MIME type or a generic
  `application/octet-stream`; the server required a recognised MIME and
  rejected those. It now falls back to the file extension (same approach the
  call-recording upload already uses), so a real JPG/HEIC/MP4 from the gallery
  is accepted and stored/served with the correct type.
  (2) A large gallery video could exceed the size limit and surface as an
  opaque server error; the client now checks size first (15 MB image / 100 MB
  video) and shows a clear message instead.

Please re-test:
- Report an incident → "Take photo" uses the camera; "From gallery" opens the
  library; both attach successfully.
- Upload a normal gallery photo → attaches, no server error.
- Upload an oversized video → clear "too large" message, not an error page.

13. WHen i try to edit checkpoint , and when i click on the Associated Site dropdown, nothing happens, so i cant edit the Associated Site. Also the scoller of this modal looks like browser , so the ui feels to bad. fix this also. This black scroller appears in all the modal in the whole system.

**FIXED.**
- Associated Site on edit: a checkpoint can't be moved to another site after
  creation (its patrol routes and scan history are tied to the site), so the
  dropdown was deliberately locked — but a disabled dropdown just looked broken
  ("nothing happens"). On edit it now shows the site name as a clear read-only
  field with a short note that it can't be changed. (Creating a checkpoint still
  uses the normal dropdown.)
- Scrollbar: the raw Windows OS scrollbar (wide, dark, with arrow buttons) is
  replaced app-wide with a thin, rounded, muted scrollbar on a transparent
  track — applied globally, so every modal and scroll area in the system picks
  it up.

Please re-test:
- Edit a checkpoint → the site shows as read-only text, no dead dropdown.
- Any modal that scrolls → thin themed scrollbar, not the black OS one.

14. WHen the guard click Perform patrol button, it shows No patrol routes configured for this site., but there is no option in the dashboard to add the route for the patrolling. 

**FIXED.** The Patrol Routes page (`/patrol/routes`) already lets you create a
route for a site and sequence its checkpoints, but — like Clients — it had no
sidebar link, so there was no visible way to add one. Added a **Patrol Routes**
link in the Guard section of the sidebar.

Please re-test:
- Sidebar → Guard → Patrol Routes → create a route for the site, add checkpoints.
- As a guard at that site, Perform Patrol now finds the configured route.

15. In the sidebar, when i select the Guards Compliance , both the Guards and Guards Compliance get selected and both looks red. 

**FIXED.** The sidebar lit up any link whose path the URL started with, so a
nested page like `/guards/compliance` highlighted both "Guards" and "Guard
Compliance". It now highlights only the single most specific match (the longest
matching path), so exactly one item is red.

Please re-test:
- Open Guard Compliance → only "Guard Compliance" is highlighted.
- Open Clients vs Client Insurance → only the one you're on is highlighted.

16. The Credits should be only used for Prospect Search and AI based feature wherever our gemini api is used. No other than these should reuquire credits.
like i went to proposal generation for a lead and it asked for credits. Assigning guards to shifts asks for credit but it should not because it isnt ai feature . 

**FIXED (guard assignment) / by design (proposals).** The guard-assignment
credit charge was the AI recommendation explanation — now free (see issue 11).
You confirmed that explicit AI proposal/RFP generation (which really does call
Gemini) should keep costing credits, so that charge stays: it matches your rule
"credits for AI features wherever Gemini is used." Genuine AI generations keep
charging; non-AI operational workflows (assigning guards/shifts) do not.

17. After sending one emergency alert , i see Emergency alert sent - dispatch has been notified. but no one is notified. An email should be send to the admin. Also the guard is locked after sending one emergency alert. THere is no option to send again. 

**FIXED.**
- The tenant's admins (verified ADMIN users) are now emailed the moment a guard
  triggers an alert: guard name, location (with a map link if a position is
  known), time, and a button to open the alert. Best-effort — a mail failure is
  logged but never hides the alert, which is still recorded and shown in-app.
- Re-send: pressing the panic button again no longer does nothing. The guard
  banner now has a **Re-send** button; the backend keeps a single live alert
  per guard (no duplicates) but re-notifies dispatch each time, so a guard whose
  alert has gone unanswered can escalate.

Please re-test:
- Trigger an alert → admin receives an email (check the configured mailbox).
- Press Re-send on the guard banner → admins are emailed again; still one alert.

18. i created a shift Start: Fri, Oct 23, 10:06 PM
End: Mon, Oct 26, 04:47 AM , and on 24 oct in the guard panel , i see No shifts today in the dashboard tab. But in the shifts tab i see the shift.

**FIXED.** The guard dashboard decided "today" purely from the shift's *start*
day, so a multi-day shift that started on an earlier day showed under neither
Today nor Upcoming. "Today" now means the shift is active at any point during
today (its start/end window overlaps today), and "Upcoming" means it starts
after today — so an in-progress multi-day shift correctly shows under Today.

Please re-test:
- A shift spanning several days shows under "Today" on each day it covers.
- A shift starting tomorrow shows under "Upcoming"; a past/finished one shows
  in neither.

19. For the client login, where does the email and password come from?? fix this also.

**ANSWERED + CLARIFIED.** There's no self-signup for clients — the agency
creates each client's portal login. On the Clients page (now reachable via the
new sidebar link, issue 10), each client has a **Create Portal User** action:
it uses the client's email as the login and generates a one-time temporary
password that you hand to the client. They then sign in at `/client/login`.

The "login created" dialog was only showing the password, which is probably why
it was unclear. It now shows the **email (login)**, the **temporary password**,
and a line stating the client signs in at `/client/login` — so it's obvious
what the credentials are and where they're used. (By design no email is sent;
the agency shares them directly.)

Please re-test:
- Clients → a client → Create Portal User → the dialog shows email + password +
  the login URL; sign in as that client at /client/login.

20. ( https://dashboard.aegislead.co/settings/plan  ) in the landing page of aegislead.co , there is a pricing page too, that is same to same as ewe have the pricing in the billing page, there is a select plan in the landing page, i want that if someone comes from the landing papge select package button, and if we add our dashboard pricing page api in the landing page select package button and redirect the useer on our dashboard, then the first our login/signup page will open , then after login , our / page opens, but i want that for the user that came from landing page, it should get redirect to our pricing plan page after signup / login. (This is not a bug, this is the feature we want to implement)

**IMPLEMENTED (dashboard side).** The dashboard login/signup now accepts a
`next` redirect target: after a successful login — or after signup + OTP
verification — the user is sent to that path instead of the default dashboard.
Only internal `/paths` are honored (so it can't be abused as an open redirect),
and the target survives the signup → OTP → login hop. `?register=1` also opens
the signup form directly.

So the marketing site's "Select plan" button just needs to link to the
dashboard with those params. For example:
- New visitor:  `https://dashboard.aegislead.co/login?register=1&next=/settings/plan`
- Existing user: `https://dashboard.aegislead.co/login?next=/settings/plan`

Both land the user on the pricing/plan page right after they authenticate.
(The landing site itself is a separate project, so its button URL needs this
one change on that side — no other dashboard work is required.)

Please re-test:
- Visit `/login?next=/settings/plan`, log in → you land on the plan page, not `/`.
- Visit `/login?register=1&next=/settings/plan` → signup opens; after verifying
  the OTP you land on the plan page.
- A normal `/login` with no `next` → unchanged (role-based landing).

21.  I  tried to signup an account, i entered the email and all the details, the OTP was sent but i didnt entered the OTP, after that i changed the mail and tried again and entered the OTP. And now, in the super-admin panel , i can see both the email as tenants. So fix this- Until the otp is verified, dont create the user as a tenant.  Also in the super-admin Tenants tab, the email of the tenants should also be visible , with plan name (if no plan is purchased, show No Plan), and remvoe the AI column, |

**FIXED.** An abandoned signup (OTP never entered) no longer shows as a tenant.
Signup still writes the tenant/user row up front — the OTP is attached to that
user, and an unverified user cannot log in or do anything — but the platform
console now lists and counts only tenants that have at least one *verified*
user. So the half-finished first attempt disappears from the Tenants tab and the
headline count; the completed one stays.

Super-admin Tenants tab also updated:
- The account email now shows under the tenant name (from the owner).
- "No Plan" is shown when nothing has been purchased (was "None").
- The AI column is removed.

Please re-test:
- Start a signup, don't enter the OTP; start another with a different email and
  verify it → only the verified one appears in Tenants.
- A tenant with no plan shows the "No Plan" badge; granted plans show their name.
- No AI column; each row shows the owner email.

22. In the whole website, change the date and time entering field to something easy. CUrrently it is DD-----yyyy and users may find it complex. Also apply the client side validations in all the fields of all the forms. At many places i can enter characters in price field, mobile no can be entered more than 10 digits , etc etc.

**IN PROGRESS — shared primitives built + applied to the key forms (you picked
this scope).** Reusable pieces so the rest of the app can follow the same
pattern without re-inventing it:
- `lib/validation.ts` — input sanitizers (`sanitizePhone` = digits, max 10;
  `sanitizePhoneIntl` = country-code numbers; `sanitizeDecimal` = money;
  `sanitizeInteger`) and submit-time validators (`validateEmail`,
  `validatePhone`, `validateRequired`).
- `components/DateTimeField.tsx` — a labelled date / date-time field that keeps
  the native calendar picker but adds a readable echo of the chosen value
  ("Fri, Oct 24, 2026, 10:06 PM") so the bare "mm/dd/yyyy" mask is no longer
  confusing.

Applied to the high-traffic forms:
- **Shifts** — friendly date-time fields; End must be after Start (inline + on
  submit).
- **Guards** — phone is digits-only capped at 10; email validated on save.
- **Clients** — same phone + email rules.
- **Leads** — phone allows a country code (it's dialed from Sales Calls, so it
  is intentionally not capped at 10); email validated.
- **Invoices** — manual rate accepts only a valid decimal (no letters).
- (Sites has no phone/number/date fields, so nothing to change there.)

Remaining forms (rate cards, RFP, timesheets, compliance, integrations, etc.)
can be migrated to these same primitives as a follow-up pass.

Please re-test:
- Shift form: date fields show a readable confirmation; End ≤ Start is blocked.
- Guard/Client phone: can't type letters or a 11th digit; bad email is caught.
- Invoice manual rate: letters can't be entered.

23.  This flash message - Getting started 5 of 5 done. It should not be visible again if all the 5 of 5 are done. I have to cut it everytime i login

**FIXED.** The Getting Started card only hid when you clicked the ×, so once
everything was set up it still came back on every login reading "5 of 5 done".
It now dismisses itself permanently the moment all steps are complete (saved to
this browser), so it won't reappear or even flash next time.

Please re-test:
- With all setup steps done, reload / log in again → the card does not appear.
- With some steps incomplete, it still shows the remaining ones.

24. If the guard is already logged in , and i deactivate it, it should get logged out with a meesage of the admin deactivated the guard account something like that.

**FIXED.** A guard's access token used to stay valid until expiry, so a
deactivated guard could keep working. The server now rejects a guard's token as
soon as the guard is deactivated (or deleted) with a `GUARD_DEACTIVATED` code
(only guard requests do this extra check). On the guard app, that response
shows "Your guard account has been deactivated by an administrator.", clears the
session and sends them to the guard login — no token-refresh loop.

Please re-test:
- Log in as a guard, then deactivate that guard from the admin side.
- The guard's next action logs them out with the deactivation message.
- Reactivating the guard lets them log in again normally.

25. at the branch page, in a branch,  i see 0
Clients
0
Sites
0
Guards 

but when i open the details of that branch , i see -- 

Assigned Records
Current records linked to this branch.

0
Clients
1
Sites
2
Guards
2
Shifts
1
Incidents
0
Reports
0
Invoices
1
Users . 

So fix this to

**FIXED.** The branch *list* query only loaded the manager, never the record
counts, so every card defaulted to 0 — while the branch *detail* query did load
counts, which is why they only appeared when you opened a branch. The list now
loads the same Clients/Sites/Guards counts, so the cards match the detail view.

Please re-test:
- Branch cards show the real Clients/Sites/Guards counts, matching each branch's
  detail page.




26. When the admin generates a proposal for a client, in that proposal all the parameters like  [Your Company Name]. [Your Name/Your Company Representative]
[Your Title]
[Your Company Name] etc are written as it is instead of their values. SO fix this also.  
Also the admin should be able to change the text after generating the proposal. 
Also the proposal generated in pdf form has many issue -
1. If the logo is not given, i see the test "logo". It should not be there.
2. All the bold text in the proposal, in the pdf is messed up, it is not in the bold , instead i see * * around  the text in the whole pdf. Also # at many places.
3. also, in the pdf, the client company name and my compnay name also overlapses. Fix this issue also.


27. In the client portal , at the /client/proposals/{id} page, the UI of the this page is too bad. I have to scroll too much to read comments and reach the end of the document whereas i see too much emppty space in left and right on my screen.
SO make the UI proper of this screen.

28. In the create RFP , apply the client side validation in all the fielsd and chagne the date format to dd-mm-yyyy instad od dd----yyyyy

29. in Add Insurance Policy, add client side validation also in the fields. 

30. Everywhere in the site wherever is there a coverage amount or something, it cant take random value, it only takes the value ending with 00. So fix this also. 

31. Everyehre in this dashboard, the date format should by DDMMYYYY. 

32. at Client Insurance & COI, when i try to uplaod the document, i get internal server error, this error might come on everywhere we can upload items. So check that also.

32. in Client Insurance & COI, whenever a policy is added by admin , it shows Valid . There is no source of validation. So remove this valid thing from here and remove the Status column from the table too that showws valid, and remove the "Valide" from the clietn portal also. 

33.  The client portal and guard portal should show same logo of aegislead as we see at the admin portal.

   

---

## Final implementation audit — 25 Oct 2026

All actionable issues recorded above have been addressed in the codebase.

- Issue 3: self-demotion and self-revocation can no longer remove an
  administrator's own Super Admin access.
- Issue 22: the remaining date-entry forms now use the shared DD-MM-YYYY or
  readable date-time controls, with validation retained on save.
- Issues 26–33: proposal rendering/editing, client proposal layout, RFP and
  insurance validation, coverage amount rules, date formatting, uploads,  
  insurance Added/Missing status, and portal branding are implemented.

The unchecked items in sections 1–17 are execution checklist rows, not newly
reported bugs; they still require manual end-to-end testing in the deployed
application.



34. in all the date fields  , all are already DD-MM-YYYY format, which is good, but i can enter the date like 53-25-6424 which is not good so apply the cleint side validation here. The date should be less than 31 , month less than 12 , you know use some logic here. The month cant be 53 and the date cant be 85 etc.

35. in all the pages with a table, enhance the overall UI. I just see rounded corner vibecoded design. I mostly see all the txt in uppercase. I see text with matching backgound color. Fix that also.

36. Fix the button ui in those pages also. The UI should look more professional.

37.  in the RFP page, after creating the rfp , the screen should scroll to generated the rfp. 
when i generated an rfp and saved it, i got logged out and and when i logged in again , the rfp generated was gone already. So i basically lost my token. So i want that on generation the rfp should automatically saved and can be edited and saved again later.

38. 