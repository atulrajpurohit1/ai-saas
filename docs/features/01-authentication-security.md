[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# Authentication, Authorization & Security

This domain covers how users prove who they are (authentication) and what they're allowed to do once logged in (authorization), across all three portals: Admin, Client, and Guard.

---

# 1. Admin Authentication (JWT)

## Purpose
Lets a company's office staff (admins, finance, schedulers, supervisors) securely log into the main application with their own private credentials.

## Overview
Admins sign up with an email/password, which creates both their company's tenant account and their own user record at the same time. From then on, they log in with that email/password and receive a secure session token that the app uses to identify them on every request.

## What User Can Do
- Register a new company account (creates the tenant + first admin user together)
- Log in with email and password
- Stay logged in across page reloads
- Log out (which also revokes the session on the server)

## Workflow
```
User submits email/password
        ↓
Password checked against stored (encrypted) hash
        ↓
System issues an access token + refresh token
        ↓
A session record is created (IP address, device info, timestamp)
        ↓
Token is stored in the browser and sent with every request
        ↓
User is redirected into the application
```

## Business Value
- Standard, secure login gives every company confidence their data is private and access-controlled.
- Registration creates a fully working tenant in one step — no manual setup required to get started.
- Session tracking (see Session Management) gives admins visibility and control over who is logged in.

## Technical Summary
- **Modules:** `auth` (backend)
- **Key logic:** Passwords are hashed with bcrypt; login issues a JWT access token and a longer-lived refresh token, both carrying the user's tenant, role, and branch. Refresh tokens are stored (hashed) and rotated on each use.
- **Database tables:** `User`, `Tenant`, `UserSession`
- **Frontend:** Combined login/registration page with a role switcher (admin/client), and an app-wide authentication context that manages the session in the browser.

## Key Capabilities
- Email/password registration and login
- Secure password storage (bcrypt hashing)
- Access + refresh token issuance
- Session record creation on every login
- Logout with server-side session revocation
- IP address / device (user agent) capture per login

## Current Status
**Fully Implemented.** One technical note: the app does not currently use the refresh-token capability automatically — when a session expires, the user is simply asked to log in again rather than being silently refreshed. This does not affect security, only convenience.

**[Insert Screenshot Here]**

---

# 2. Client Portal Authentication

## Purpose
Gives a company's own customers (the clients who receive guard services) a separate, private login to their own portal.

## Overview
A client contact can either be invited by the admin (an "Enable Portal" action creates their login and a one-time temporary password) or, where enabled, sign themselves up directly. Either way, they log in separately from admin staff, using a different login page, and only ever see their own company's data.

## What User Can Do
- Log in to the Client Portal with email/password
- Self-register (where enabled for the tenant)
- Log out

## Workflow
```
Admin clicks "Enable Portal" for a client
        ↓
System generates a one-time temporary password
        ↓
Client logs in with that email/password at the Client Portal
        ↓
Client is scoped to only their own company's proposals,
invoices, incidents, reports, and documents
```

## Business Value
- Reduces admin workload — clients can self-serve for invoices, proposals, and reports instead of emailing the office.
- Builds trust and transparency by giving clients direct visibility into their own service records.

## Technical Summary
- **Modules:** `client-auth`
- **Key logic:** Authenticates against a separate `ClientUser` record, issues the same style of JWT but tagged with the client's role and client ID so downstream features can restrict data access correctly.
- **Database tables:** `ClientUser`, `Client`
- **Frontend:** Dedicated `/client/login` page; a shared client layout wraps every client-portal page.

## Key Capabilities
- Client-specific login
- Self-service registration path (where configured)
- Logout with token invalidation

## Current Status
**Partially Implemented.** Login, registration, and logout work correctly and are used by real client-portal pages. Two known gaps: (1) the token-refresh capability exists on the backend but is not connected to any usable endpoint, so client sessions simply expire and require re-login; (2) client logins do not appear in the admin's Session Management screen, so an admin cannot see or force-revoke a client's active session from that screen.

**[Insert Screenshot Here]**

---

# 3. Guard Portal Authentication

## Purpose
Gives field security guards a simple, mobile-friendly login separate from the office/admin system.

## Overview
Guards log in with their phone number or email plus a password (set by an admin when the guard is added to the roster). This gives them access to a lightweight, phone-first portal for their shifts, patrols, and incident reporting.

## What User Can Do
- Log in to the Guard Portal with phone/email + password

## Workflow
```
Guard enters phone/email + password
        ↓
System matches against the guard roster and verifies the password
        ↓
Guard receives a session token scoped to "guard" access only
        ↓
Guard is taken to their shift dashboard
```

## Business Value
- Lets field staff — who may not have a company email or ever touch the admin app — access exactly what they need on a phone, nothing more.

## Technical Summary
- **Modules:** `guard-auth`
- **Key logic:** Looks up the guard by phone/email, verifies the password, issues a JWT tagged with the guard's role and ID.
- **Database tables:** `Guard`

## Key Capabilities
- Phone or email login
- Guard-scoped session token

## Current Status
**Partially Implemented.** Login works and is used by real guard-portal pages. There is currently no dedicated logout endpoint, no session tracking for guard logins (so they don't appear in the admin Session Management screen), and no automatic token refresh — a guard's session simply expires after a period and requires logging in again.

**[Insert Screenshot Here]**

---

# 4. Single Sign-On (SSO)

## Purpose
Lets enterprise clients' IT departments require staff to log in with their existing corporate identity (Google Workspace, Microsoft, Okta, Auth0, or another provider), instead of a separate password to remember.

## Overview
An admin configures a connection to their company's identity provider. From then on, staff can click "Continue with SSO" on the login page and are securely redirected to their company's own login screen; once approved there, they're brought back into the app already logged in, with their role automatically assigned based on their identity-provider group membership.

## What User Can Do
- Admin: configure, test, and manage one or more SSO providers per company
- Admin: map identity-provider groups to in-app roles automatically
- Admin: restrict SSO login to specific email domains
- End user: log in via "Continue with SSO" instead of a password

## Workflow
```
Admin configures an SSO provider (client ID/secret, discovery URL, allowed domains)
        ↓
Admin maps identity-provider groups to in-app roles
        ↓
User clicks "Continue with SSO" and enters their email
        ↓
System finds the matching provider and redirects to the identity provider
        ↓
User logs in with their corporate credentials
        ↓
Identity provider redirects back with a signed confirmation
        ↓
System verifies the signature, creates/updates the user, applies role mapping
        ↓
User is logged into the app
```

## Business Value
- Removes password fatigue and reduces helpdesk password-reset requests for enterprise clients.
- Centralizes access control — when an employee leaves the client company, disabling their corporate account also cuts off app access.
- A recognized enterprise-readiness feature that helps close larger deals.

## Technical Summary
- **Modules:** `sso`
- **Key logic:** Implements the industry-standard OIDC login flow with cryptographic verification of the identity provider's response, automatic user creation on first login, and role assignment driven by identity-provider group membership.
- **Database tables:** `SSOProvider`, `SSORoleMapping`, `SSOLoginState`, `UserSession`
- **Frontend:** SSO provider management screen (Settings → SSO), and a callback page that completes the login.

## Key Capabilities
- OIDC-based SSO login (Google/Microsoft/Okta/Auth0/generic)
- Automatic ("just-in-time") user provisioning on first SSO login
- Identity-provider group → in-app role mapping
- Email-domain restriction per provider
- Connectivity "test" tool for admins configuring a provider
- Full audit trail of SSO configuration changes and login attempts

## Current Status
**Partially Implemented.** OIDC-based SSO (the most common enterprise standard) works fully end to end. **SAML-based SSO can be started but not completed** — an admin can configure a SAML provider and a user can be redirected to their identity provider, but there is currently no page to receive and complete that login, so a user choosing SAML SSO would not be able to finish signing in. This should be treated as an open item, not a working alternative to OIDC.

**[Insert Screenshot Here]**

---

# 5. Role-Based Access Control (RBAC)

## Purpose
Controls exactly what each staff member is allowed to see and do in the application, so sensitive actions (like issuing invoices or changing roles) are restricted to the right people.

## Overview
Every company gets a set of ready-made roles (Super Admin, Branch Admin, Scheduler, Supervisor, Finance) covering common staffing patterns, and can also create fully custom roles built from a catalog of ~85 individual permissions (e.g. "view leads," "mark invoices paid," "manage SSO"). Roles can be assigned tenant-wide or scoped to a single branch.

## What User Can Do
- View the full permission catalog, grouped by module
- Create, edit, and delete custom roles
- Assign a role to a user, optionally scoped to one branch
- Revoke a user's role assignment
- See exactly which permissions the currently logged-in user has (used to show/hide buttons and pages throughout the app)

## Workflow
```
Admin opens Settings → Roles
        ↓
Admin creates a custom role and selects specific permissions
        ↓
Admin assigns that role to a staff member (optionally for one branch only)
        ↓
That staff member's next login (or next permission check) reflects the new access
        ↓
Every API request checks the required permission before allowing the action
```

## Business Value
- Prevents accidental or unauthorized actions (e.g. a scheduler cannot issue invoices).
- Supports real organizational structures — a branch manager only needs to see their own branch.
- Reduces onboarding friction: new staff get a sensible default role immediately, with fine-tuning available later.

## Technical Summary
- **Modules:** `roles`
- **Key logic:** ~85 permission keys defined in a central catalog, synced into the database automatically. 7 system roles are auto-created per tenant. Every protected API endpoint checks the caller's permissions before executing. A safeguard prevents any non-super-admin from granting permissions they don't themselves hold.
- **Database tables:** `Permission`, `Role`, `RolePermission`, `UserRoleAssignment`
- **Frontend:** Settings → Roles page with a permission checkbox matrix and a user-to-role assignment tool.

## Key Capabilities
- ~85 granular permission keys across every module
- 7 pre-built system roles (cannot be edited/deleted)
- Unlimited custom, tenant-defined roles
- Branch-scoped or tenant-wide role assignment
- Permission-escalation prevention
- Full audit trail of role/assignment changes

## Current Status
**Fully Implemented.** This is one of the most thoroughly built features in the platform — enforced consistently at the API level across every module, and mirrored in the frontend to hide/disable UI the current user isn't permitted to use.

**[Insert Screenshot Here]**

---

# 6. Field-Level Permissions

## Purpose
Goes one level deeper than RBAC: restricts access to specific *sensitive fields* on a record (like a guard's salary or a client's private billing notes), even when a role can otherwise see the record itself.

## Overview
An admin can configure, per role, whether that role can view and/or edit particular sensitive fields — for example, letting a Scheduler see a guard's name and shifts, but hiding their salary and bank details, without needing an entirely separate "Guard (no payroll)" role.

## What User Can Do
- View the catalog of protected fields (currently covering Guard, Client, and Invoice records)
- Set per-role view/edit permission for each protected field
- See sensitive fields automatically hidden or disabled in the UI based on their own role's permissions

## Workflow
```
Admin opens Settings → Field Permissions
        ↓
Admin selects a role and a record type (e.g. Guard)
        ↓
Admin toggles view/edit for sensitive fields (salary, bank details, documents, personal notes)
        ↓
Any user with that role now has those fields automatically
hidden (if view is off) or read-only (if edit is off) everywhere in the app
```

## Business Value
- Protects payroll and confidential business data without duplicating the entire role structure.
- Reduces the risk of sensitive data (like bank account numbers) being seen by staff who don't need it.

## Technical Summary
- **Modules:** `field-permissions`
- **Key logic:** A fixed catalog of sensitive fields per entity (guard salary/bank details/documents/personal notes; client billing/internal notes; invoice internal adjustments). Permission checks are applied both when data is read (fields are stripped from the response) and when data is written (an edit attempt on a locked field is rejected), and every blocked access attempt is logged.
- **Database tables:** `FieldPermission`
- **Frontend:** Settings → Field Permissions grid; consuming pages (Guards, Clients, Invoices) automatically hide/disable the relevant fields based on the logged-in user's effective permissions.

## Key Capabilities
- Per-role, per-field view/edit control
- Applies to Guard, Client, and Invoice records
- Enforced on both read and write, not just visually hidden
- Automatic audit logging of blocked access attempts
- Super admins always see everything

## Current Status
**Fully Implemented.** A genuinely complete feature, verified wired end-to-end into the three business areas it protects, not just a settings screen with no real effect.

**[Insert Screenshot Here]**

---

# 7. Session Management

## Purpose
Gives admins visibility into who is currently logged into the admin application, and the ability to immediately force a suspicious or unwanted session to log out.

## Overview
Every admin/SSO login creates a tracked session record (device, IP address, when they last used the app, when the session will expire). An admin with the right permission can view all active sessions for their company and revoke any one of them instantly.

## What User Can Do
- View all active admin sessions for their company (user, login method, last activity, status)
- Force any session to log out immediately

## Workflow
```
User logs in (password or SSO)
        ↓
A session record is created (device/IP/timestamp)
        ↓
Session automatically expires after a period of inactivity
or after a fixed maximum duration
        ↓
Admin can view the session list at any time
        ↓
Admin can force-revoke any session (e.g. a lost device, an offboarded employee)
```

## Business Value
- Lets a company immediately cut off access if a device is lost or an employee leaves, without waiting for a password reset.
- Provides basic visibility into account activity for security review.

## Technical Summary
- **Modules:** `sessions`
- **Key logic:** Every login/refresh creates or rotates a session record with an idle timeout (default 8 hours) and an absolute expiry (default 30 days); either condition automatically invalidates the session.
- **Database tables:** `UserSession`
- **Frontend:** Settings → Sessions page listing all sessions with a force-logout action.

## Key Capabilities
- Full session listing (user, source, device, last seen, status)
- Idle timeout and absolute expiry enforcement
- One-click forced logout
- Full audit trail of session creation/expiry/revocation

## Current Status
**Partially Implemented.** Fully working for the admin application, including SSO logins. **Not implemented for the Client Portal or Guard Portal** — those logins do not create a tracked session, so they are invisible to (and cannot be revoked from) this screen.

**[Insert Screenshot Here]**

---

# 8. Audit Logging

## Purpose
Keeps a record of security- and business-sensitive actions for traceability and compliance purposes.

## Overview
Whenever something notable happens — a login, a role change, an SSO configuration update, a blocked access attempt, a forced logout, and many other actions across the platform — a record is written automatically, tagged with who did it, what it affected, and when.

## What User Can Do
- View a company's recent activity log (latest 100 entries)

## Workflow
```
An action occurs anywhere in the system (login, role change, etc.)
        ↓
The system automatically writes a log entry (who / what / when / details)
        ↓
Admin with the "view audit log" permission can review recent activity
```

## Business Value
- Supports compliance and internal investigation needs.
- Gives admins a way to answer "who changed this and when."

## Technical Summary
- **Modules:** `audit`
- **Key logic:** A single shared logging service is called from across the codebase (authentication, roles, sessions, SSO, field permissions, and more) to write a consistent activity record.
- **Database tables:** `AuditLog`
- **Frontend:** Audit page with a simple activity table.

## Key Capabilities
- Automatic, consistent activity logging across many modules
- Tenant-isolated (a company only ever sees its own activity)

## Current Status
**Fully Implemented as a basic capability.** The logging itself is broadly and consistently used throughout the platform. It should be described to stakeholders as a **basic** audit trail: there is currently no filtering, search, date-range selection, pagination, or export on the log — only the most recent 100 entries are shown.

**[Insert Screenshot Here]**

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
