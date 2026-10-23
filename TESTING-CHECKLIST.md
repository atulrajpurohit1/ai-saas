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

2. The Role page is too much confusing for a non developer user. It has too many selective options for different roles the user is neither going to read and understand. So make it super simple, anoption to add user, give role , assign branch, email and pass of invited  user. 

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

3.
