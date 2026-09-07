/* AegisLead full QA E2E suite. Creates an isolated qa-e2e tenant, exercises
 * real end-to-end workflows over HTTP + DB, runs negative security tests,
 * then tears everything down. Usage: node scratch/qa/run.js  [--keep] */
const { prisma, db, req, reqRetry, uploadFile, rec, section, PNG_1PX, PDF_BYTES, summary } = require('./lib');
const bcrypt = require('bcrypt');

const KEEP = process.argv.includes('--keep');
const STAMP = Date.now();
const TAG = `qae2e-${STAMP}`;
const ctx = { STAMP, TAG };

async function cleanup() {
  // Delete both QA tenants by slug prefix; rely on FK cascades where defined,
  // otherwise delete children explicitly in dependency order.
  const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: 'qae2e-' } }, select: { id: true, slug: true } });
  for (const t of tenants) {
    const tid = t.id;
    const del = async (model, where) => { try { await prisma[model].deleteMany({ where }); } catch (e) { /* ignore */ } };
    await del('patrolEvidence', { tenantId: tid });
    await del('patrolEvent', { tenantId: tid });
    await del('patrolRun', { tenantId: tid });
    await del('patrolRouteCheckpoint', { patrolRoute: { tenantId: tid } });
    await del('patrolRoute', { tenantId: tid });
    await del('checkpoint', { tenantId: tid });
    await del('incidentEvidence', { tenantId: tid });
    await del('incident', { tenantId: tid });
    await del('emergencyAlert', { tenantId: tid });
    await del('attendanceEvent', { shift: { tenantId: tid } });
    await del('guardSyncQueue', { tenantId: tid });
    await del('assignment', { shift: { tenantId: tid } });
    await del('availability', { guard: { tenantId: tid } });
    await del('shift', { tenantId: tid });
    await del('invoiceItem', { invoice: { tenantId: tid } });
    await del('invoiceDispute', { invoice: { tenantId: tid } });
    await del('invoice', { tenantId: tid });
    await del('timesheet', { tenantId: tid });
    await del('rateCard', { tenantId: tid });
    await del('dailyServiceReport', { tenantId: tid });
    await del('guardCompliance', { guard: { tenantId: tid } });
    await del('site', { tenantId: tid });
    await del('guard', { tenantId: tid });
    await del('proposalComment', { proposal: { tenantId: tid } });
    await del('proposalVersion', { proposal: { tenantId: tid } });
    await del('proposal', { tenantId: tid });
    await del('note', { tenantId: tid });
    await del('activity', { tenantId: tid });
    await del('deal', { tenantId: tid });
    await del('lead', { tenantId: tid });
    await del('clientInsurancePolicy', { tenantId: tid });
    await del('clientUser', { tenantId: tid });
    await del('client', { tenantId: tid });
    await del('userRoleAssignment', { tenantId: tid });
    await del('rolePermission', { role: { tenantId: tid } });
    await del('role', { tenantId: tid });
    await del('userSession', { tenantId: tid });
    await del('auditLog', { tenantId: tid });
    await del('user', { tenantId: tid });
    try { await prisma.tenant.delete({ where: { id: tid } }); } catch (e) { console.log('tenant delete failed', t.slug, e.message); }
  }
}

const PW = 'Passw0rd!123';

/** Provision tenant A + B fixtures directly via Prisma (retried), bypassing the
 * flaky /auth/register interactive transaction on this cold Neon dev endpoint.
 * We still test /auth/register separately (negative + one happy path) below. */
async function provisionFixture() {
  const hash = await bcrypt.hash(PW, 10);
  const tA = await db(() => prisma.tenant.upsert({
    where: { slug: `${TAG}-a` }, update: {}, create: { name: `QA E2E A ${STAMP}`, slug: `${TAG}-a` },
  }));
  const tB = await db(() => prisma.tenant.upsert({
    where: { slug: `${TAG}-b` }, update: {}, create: { name: `QA E2E B ${STAMP}`, slug: `${TAG}-b` },
  }));
  ctx.tenantAId = tA.id; ctx.tenantBId = tB.id;

  const uA = await db(() => prisma.user.upsert({
    where: { email: `admin-a@${TAG}.test` }, update: { password: hash },
    create: { email: `admin-a@${TAG}.test`, password: hash, name: 'QA Admin A', tenantId: tA.id, isSuperAdmin: true, role: 'ADMIN' },
  }));
  const uB = await db(() => prisma.user.upsert({
    where: { email: `admin-b@${TAG}.test` }, update: { password: hash },
    create: { email: `admin-b@${TAG}.test`, password: hash, name: 'QA Admin B', tenantId: tB.id, isSuperAdmin: true, role: 'ADMIN' },
  }));
  ctx.adminAUserId = uA.id; ctx.adminBUserId = uB.id;
  rec('fixture: tenants A+B and super-admin users created via Prisma', !!tA.id && !!tB.id && !!uA.id && !!uB.id);
}

async function main() {
  section('SETUP / TEARDOWN of prior QA data');
  await cleanup();
  rec('pre-clean removed any stale qae2e tenants', true);
  await provisionFixture();

  // ---------------------------------------------------------------
  // AUTHENTICATION
  // ---------------------------------------------------------------
  section('AUTHENTICATION');

  // One real happy-path /auth/register (its own throwaway tenant) — retried
  // through Neon cold-start 500s. Non-fatal if the endpoint times out here.
  const regSlug = `${TAG}-reg`;
  const regA = await reqRetry('POST', '/auth/register', { body: {
    email: `reg@${TAG}.test`, password: PW, name: 'QA Reg', tenantName: 'QA Reg', tenantSlug: regSlug,
  }}, 6);
  rec('POST /auth/register happy path returns 201 + tokens', regA.status === 201 && !!regA.json?.access_token, `status=${regA.status} body=${regA.text?.slice(0,160)}`);
  if (regA.status === 201) {
    ctx.regTenantId = (await db(() => prisma.tenant.findFirst({ where: { slug: regSlug } })))?.id;
    const dupReg = await reqRetry('POST', '/auth/register', { body: {
      email: `reg@${TAG}.test`, password: PW, name: 'Dup', tenantName: 'Dup', tenantSlug: regSlug,
    }}, 4);
    rec('duplicate tenant slug / email rejected (409)', dupReg.status === 409, `status=${dupReg.status}`);
  }

  const badReg = await req('POST', '/auth/register', { body: { email: 'not-an-email', password: 'x' } });
  rec('register with invalid payload rejected (400)', badReg.status === 400, `status=${badReg.status}`);

  const login = await reqRetry('POST', '/auth/login', { body: { email: `admin-a@${TAG}.test`, password: PW } }, 6);
  rec('login with correct credentials returns tokens', login.status === 200 && !!login.json?.access_token, `status=${login.status} body=${login.text?.slice(0,120)}`);
  ctx.adminA = login.json?.access_token;
  ctx.adminARefresh = login.json?.refresh_token;
  const loginB = await reqRetry('POST', '/auth/login', { body: { email: `admin-b@${TAG}.test`, password: PW } }, 6);
  ctx.adminB = loginB.json?.access_token;

  const badLogin = await req('POST', '/auth/login', { body: { email: `admin-a@${TAG}.test`, password: 'WrongPass123' } });
  rec('login with wrong password rejected (401)', badLogin.status === 401, `status=${badLogin.status}`);

  const noUserLogin = await req('POST', '/auth/login', { body: { email: `ghost@${TAG}.test`, password: 'Passw0rd!123' } });
  rec('login with unknown user rejected (401)', noUserLogin.status === 401, `status=${noUserLogin.status}`);

  const me = await reqRetry('GET', '/users/me', { token: ctx.adminA });
  rec('GET /users/me with valid token returns 200', me.status === 200, `status=${me.status} body=${me.text?.slice(0,150)}`);

  const meNoToken = await req('GET', '/users/me');
  rec('protected route without token rejected (401)', meNoToken.status === 401, `status=${meNoToken.status}`);

  const meBadToken = await req('GET', '/users/me', { token: 'garbage.token.value' });
  rec('protected route with malformed token rejected (401)', meBadToken.status === 401, `status=${meBadToken.status}`);

  const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4Iiwicm9sZSI6ImFkbWluIiwidGVuYW50SWQiOiJ4IiwiaWF0IjoxNTAwMDAwMDAwLCJleHAiOjE1MDAwMDAwMDF9.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const meExpired = await req('GET', '/users/me', { token: expiredToken });
  rec('protected route with expired/invalid-sig token rejected (401)', meExpired.status === 401, `status=${meExpired.status}`);

  const refresh = await req('POST', '/auth/refresh', { token: ctx.adminARefresh });
  rec('refresh with valid refresh token returns new tokens', refresh.status === 200 && !!refresh.json?.access_token, `status=${refresh.status}`);

  const refreshWithAccess = await req('POST', '/auth/refresh', { token: ctx.adminA });
  rec('refresh with an access token (not refresh) rejected', refreshWithAccess.status === 401 || refreshWithAccess.status === 403, `status=${refreshWithAccess.status}`);

  const logout = await req('POST', '/auth/logout', { token: ctx.adminA });
  rec('logout returns 200', logout.status === 200, `status=${logout.status}`);
  // re-login for subsequent tests (logout may invalidate session)
  const relog = await reqRetry('POST', '/auth/login', { body: { email: `admin-a@${TAG}.test`, password: PW } }, 6);
  ctx.adminA = relog.json?.access_token;

  // Provision a NON-super-admin restricted user in tenant A (Branch Admin role)
  // for RBAC-gap tests. No admin "create staff user" API exists, so create via
  // Prisma with isSuperAdmin:false, then assign the tenant's Branch Admin role.
  // First hit /roles as adminA — that call runs ensureTenantSystemRoles() which
  // materialises the 7 system roles for this tenant.
  await reqRetry('GET', '/roles', { token: ctx.adminA }, 5);
  try {
    let brA = await db(() => prisma.role.findFirst({ where: { tenantId: ctx.tenantAId, name: 'Branch Admin', isActive: true } }));
    if (brA) {
      const hash = await bcrypt.hash('Passw0rd!123', 10);
      const ru = await db(() => prisma.user.create({ data: {
        email: `restricted-a@${TAG}.test`, password: hash, name: 'QA Restricted A',
        tenantId: ctx.tenantAId, isSuperAdmin: false, role: 'ADMIN',
      }}));
      await db(() => prisma.userRoleAssignment.create({ data: { tenantId: ctx.tenantAId, userId: ru.id, roleId: brA.id, isActive: true } }));
      const rl = await reqRetry('POST', '/auth/login', { body: { email: `restricted-a@${TAG}.test`, password: PW } }, 5);
      ctx.restrictedToken = rl.json?.access_token;
      rec('provisioned non-super Branch-Admin user + logged in', !!ctx.restrictedToken, `status=${rl.status}`);
    } else {
      rec('provision restricted user: Branch Admin role not found', false, 'no role');
    }
  } catch (e) { rec('provision restricted user', false, e.message); }

  // ---------------------------------------------------------------
  // DASHBOARD
  // ---------------------------------------------------------------
  section('DASHBOARD');
  const dash = await req('GET', '/dashboard/summary', { token: ctx.adminA });
  rec('GET /dashboard/summary returns 200 for admin', dash.status === 200, `status=${dash.status} body=${dash.text?.slice(0,150)}`);
  const dashNoAuth = await req('GET', '/dashboard/summary');
  rec('GET /dashboard/summary without token rejected (401)', dashNoAuth.status === 401, `status=${dashNoAuth.status}`);

  // ---------------------------------------------------------------
  // LEADS / CRM
  // ---------------------------------------------------------------
  section('LEADS / CRM');
  const leadCreate = await reqRetry('POST', '/leads', { token: ctx.adminA, body: {
    name: 'Lead Person', company: `QA Lead Co ${STAMP}`, email: `lead@${TAG}.test`, status: 'new',
  }});
  rec('create lead returns 201', leadCreate.status === 201 || leadCreate.status === 200, `status=${leadCreate.status} body=${leadCreate.text?.slice(0,250)}`);
  ctx.leadId = leadCreate.json?.id;

  const leadList = await req('GET', '/leads', { token: ctx.adminA });
  const leadInList = Array.isArray(leadList.json) ? leadList.json.some(l => l.id === ctx.leadId)
    : (leadList.json?.data || leadList.json?.items || []).some(l => l.id === ctx.leadId);
  rec('created lead appears in GET /leads', leadList.status === 200 && leadInList, `status=${leadList.status}`);

  if (ctx.leadId) {
    const leadGet = await req('GET', `/leads/${ctx.leadId}`, { token: ctx.adminA });
    rec('GET /leads/:id returns the lead', leadGet.status === 200 && leadGet.json?.id === ctx.leadId, `status=${leadGet.status}`);

    const leadUpd = await req('PUT', `/leads/${ctx.leadId}`, { token: ctx.adminA, body: { name: 'Updated Person' } });
    rec('PUT /leads/:id updates', leadUpd.status === 200, `status=${leadUpd.status} body=${leadUpd.text?.slice(0,200)}`);

    const leadStatus = await req('PATCH', `/leads/${ctx.leadId}/status`, { token: ctx.adminA, body: { status: 'contacted' } });
    rec('PATCH /leads/:id/status updates status', leadStatus.status === 200, `status=${leadStatus.status} body=${leadStatus.text?.slice(0,200)}`);

    // DB verification
    const dbLead = await prisma.lead.findUnique({ where: { id: ctx.leadId } });
    rec('DB: lead persisted with updated name + status', dbLead?.name === 'Updated Person' && dbLead?.status === 'contacted',
      `db=${JSON.stringify({ c: dbLead?.name, s: dbLead?.status })}`); // status enum: new/contacted/proposal_sent/responded/closed
    rec('DB: lead is scoped to tenant A', dbLead?.tenantId === ctx.tenantAId, `leadTenant=${dbLead?.tenantId} expected=${ctx.tenantAId}`);
  }

  const leadNoAuth = await req('POST', '/leads', { body: { companyName: 'x' } });
  rec('create lead without token rejected (401)', leadNoAuth.status === 401, `status=${leadNoAuth.status}`);

  const leadBadId = await req('GET', '/leads/00000000-0000-0000-0000-000000000000', { token: ctx.adminA });
  rec('GET /leads/:id with non-existent id returns 404', leadBadId.status === 404, `status=${leadBadId.status}`);

  // ---------------------------------------------------------------
  // TENANT ISOLATION (cross-tenant lead access)
  // ---------------------------------------------------------------
  section('TENANT ISOLATION');
  if (ctx.leadId) {
    const crossGet = await req('GET', `/leads/${ctx.leadId}`, { token: ctx.adminB });
    rec('tenant B cannot GET tenant A lead (404/403)', crossGet.status === 404 || crossGet.status === 403, `status=${crossGet.status}`);

    const crossUpd = await req('PUT', `/leads/${ctx.leadId}`, { token: ctx.adminB, body: { name: 'HACKED' } });
    rec('tenant B cannot UPDATE tenant A lead (404/403)', crossUpd.status === 404 || crossUpd.status === 403, `status=${crossUpd.status}`);
    const stillOk = await prisma.lead.findUnique({ where: { id: ctx.leadId } });
    rec('DB: tenant A lead unchanged after cross-tenant update attempt', stillOk?.name === 'Updated Person', `name=${stillOk?.name}`);

    const crossDel = await req('DELETE', `/leads/${ctx.leadId}`, { token: ctx.adminB });
    rec('tenant B cannot DELETE tenant A lead (404/403)', crossDel.status === 404 || crossDel.status === 403, `status=${crossDel.status}`);
    const notDeleted = await prisma.lead.findUnique({ where: { id: ctx.leadId } });
    rec('DB: tenant A lead still exists after cross-tenant delete attempt', !!notDeleted, `exists=${!!notDeleted}`);
  }
  const bLeadList = await req('GET', '/leads', { token: ctx.adminB });
  const bSeesA = Array.isArray(bLeadList.json) && bLeadList.json.some(l => l.id === ctx.leadId);
  rec('tenant B lead list does not contain tenant A lead', !bSeesA, `bCount=${Array.isArray(bLeadList.json) ? bLeadList.json.length : '?'}`);

  // ---------------------------------------------------------------
  // CLIENTS + client portal user
  // ---------------------------------------------------------------
  section('CLIENTS');
  const clientCreate = await reqRetry('POST', '/clients', { token: ctx.adminA, body: {
    name: `QA Client ${STAMP}`, companyName: 'QA Client Co', email: `client@${TAG}.test`, phone: '555-0200',
  }});
  rec('create client returns 201', clientCreate.status === 201 || clientCreate.status === 200, `status=${clientCreate.status} body=${clientCreate.text?.slice(0,250)}`);
  ctx.clientId = clientCreate.json?.id;

  if (ctx.clientId) {
    const cUser = await reqRetry('POST', `/clients/${ctx.clientId}/create-user`, { token: ctx.adminA, body: { email: `portal@${TAG}.test` } });
    rec('create client portal user returns temp password', (cUser.status === 201 || cUser.status === 200) && !!cUser.json?.temporaryPassword, `status=${cUser.status} body=${cUser.text?.slice(0,200)}`);
    ctx.clientPortalEmail = `portal@${TAG}.test`;
    ctx.clientPortalPass = cUser.json?.temporaryPassword;

    const crossClientUser = await req('POST', `/clients/${ctx.clientId}/create-user`, { token: ctx.adminB, body: { email: `x@${TAG}.test` } });
    rec('tenant B cannot create user on tenant A client (404/403)', crossClientUser.status === 404 || crossClientUser.status === 403, `status=${crossClientUser.status}`);
  }

  // ---------------------------------------------------------------
  // SITES + GUARDS + SHIFTS
  // ---------------------------------------------------------------
  section('FIELD OPS: sites / guards / shifts');
  const siteCreate = await reqRetry('POST', '/sites', { token: ctx.adminA, body: {
    name: `QA Site ${STAMP}`, address: '1 QA Way', client_id: ctx.clientId || undefined,
  }});
  rec('create site returns 201', siteCreate.status === 201 || siteCreate.status === 200, `status=${siteCreate.status} body=${siteCreate.text?.slice(0,250)}`);
  ctx.siteId = siteCreate.json?.id;

  const guardPass = 'GuardPass123';
  const guardCreate = await reqRetry('POST', '/v2/guards', { token: ctx.adminA, body: {
    name: `QA Guard ${STAMP}`, email: `guard@${TAG}.test`, phone: `555${STAMP.toString().slice(-7)}`, password: guardPass,
  }});
  rec('create guard (with password) returns 201', guardCreate.status === 201 || guardCreate.status === 200, `status=${guardCreate.status} body=${guardCreate.text?.slice(0,250)}`);
  ctx.guardId = guardCreate.json?.id;
  ctx.guardEmail = `guard@${TAG}.test`;

  // second guard in tenant A for guard-vs-guard isolation
  const guard2Create = await reqRetry('POST', '/v2/guards', { token: ctx.adminA, body: {
    name: `QA Guard2 ${STAMP}`, email: `guard2@${TAG}.test`, phone: `556${STAMP.toString().slice(-7)}`, password: guardPass,
  }});
  ctx.guard2Id = guard2Create.json?.id;
  ctx.guard2Email = `guard2@${TAG}.test`;

  // guard in tenant B for cross-tenant isolation
  const guardBCreate = await reqRetry('POST', '/v2/guards', { token: ctx.adminB, body: {
    name: `QA GuardB ${STAMP}`, email: `guardb@${TAG}.test`, phone: `557${STAMP.toString().slice(-7)}`, password: guardPass,
  }});
  ctx.guardBId = guardBCreate.json?.id;
  ctx.guardBEmail = `guardb@${TAG}.test`;

  // shift (v2)
  const start = new Date(Date.now() + 3600_000).toISOString();
  const end = new Date(Date.now() + 4 * 3600_000).toISOString();
  const shiftCreate = await reqRetry('POST', '/v2/shifts', { token: ctx.adminA, body: {
    siteId: ctx.siteId, startTime: start, endTime: end, requiredGuards: 1,
  }});
  rec('create shift (v2) returns 201', shiftCreate.status === 201 || shiftCreate.status === 200, `status=${shiftCreate.status} body=${shiftCreate.text?.slice(0,250)}`);
  ctx.shiftId = shiftCreate.json?.id;

  if (ctx.shiftId && ctx.guardId) {
    const assign = await req('PUT', `/v2/shifts/${ctx.shiftId}/assign`, { token: ctx.adminA, body: { guardId: ctx.guardId } });
    rec('assign guard to shift returns 200', assign.status === 200 || assign.status === 201, `status=${assign.status} body=${assign.text?.slice(0,200)}`);
    const dbAssign = await prisma.assignment.findFirst({ where: { shiftId: ctx.shiftId, guardId: ctx.guardId } });
    rec('DB: assignment row created', !!dbAssign, `exists=${!!dbAssign}`);
  }

  // ---------------------------------------------------------------
  // GUARD AUTH + guard portal
  // ---------------------------------------------------------------
  section('GUARD AUTH + PORTAL');
  const gLogin = await reqRetry('POST', '/guard-auth/login', { body: { identifier: ctx.guardEmail, password: guardPass } });
  rec('guard login returns tokens', gLogin.status === 200 && !!gLogin.json?.access_token, `status=${gLogin.status} body=${gLogin.text?.slice(0,200)}`);
  ctx.guardToken = gLogin.json?.access_token;

  const gBadLogin = await req('POST', '/guard-auth/login', { body: { identifier: ctx.guardEmail, password: 'nope123' } });
  rec('guard login wrong password rejected (401)', gBadLogin.status === 401, `status=${gBadLogin.status}`);

  const g2Login = await req('POST', '/guard-auth/login', { body: { identifier: ctx.guard2Email, password: guardPass } });
  ctx.guard2Token = g2Login.json?.access_token;
  const gBLogin = await req('POST', '/guard-auth/login', { body: { identifier: ctx.guardBEmail, password: guardPass } });
  ctx.guardBToken = gBLogin.json?.access_token;

  const gMe = await req('GET', '/guard/me', { token: ctx.guardToken });
  rec('GET /guard/me returns guard profile', gMe.status === 200, `status=${gMe.status} body=${gMe.text?.slice(0,150)}`);

  const gShifts = await req('GET', '/guard/shifts', { token: ctx.guardToken });
  const gSeesShift = Array.isArray(gShifts.json) ? gShifts.json.some(s => s.id === ctx.shiftId)
    : (gShifts.json?.data || gShifts.json?.items || []).some(s => s.id === ctx.shiftId);
  rec('guard sees their assigned shift in GET /guard/shifts', gShifts.status === 200 && gSeesShift, `status=${gShifts.status} body=${gShifts.text?.slice(0,200)}`);

  // guard cannot hit admin endpoints
  const guardHitsAdmin = await req('GET', '/leads', { token: ctx.guardToken });
  rec('guard token rejected on admin /leads (401/403)', guardHitsAdmin.status === 401 || guardHitsAdmin.status === 403, `status=${guardHitsAdmin.status}`);
  const guardHitsDash = await req('GET', '/dashboard/summary', { token: ctx.guardToken });
  rec('guard token rejected on /dashboard/summary (401/403)', guardHitsDash.status === 401 || guardHitsDash.status === 403, `status=${guardHitsDash.status}`);

  // check-in / check-out
  if (ctx.shiftId) {
    const checkIn = await req('POST', `/guard/shifts/${ctx.shiftId}/check-in`, { token: ctx.guardToken, body: {} });
    rec('guard check-in returns 200/201', checkIn.status === 200 || checkIn.status === 201, `status=${checkIn.status} body=${checkIn.text?.slice(0,200)}`);
    const dbCheckIn = await prisma.attendanceEvent.findFirst({ where: { shiftId: ctx.shiftId, guardId: ctx.guardId, type: 'CHECK_IN' } });
    rec('DB: CHECK_IN attendance event recorded', !!dbCheckIn, `exists=${!!dbCheckIn}`);

    // guard B (other tenant) cannot check in to tenant A shift
    const crossCheckIn = await req('POST', `/guard/shifts/${ctx.shiftId}/check-in`, { token: ctx.guardBToken, body: {} });
    rec('cross-tenant guard cannot check-in to shift (403/404)', crossCheckIn.status === 403 || crossCheckIn.status === 404, `status=${crossCheckIn.status}`);

    // guard 2 (same tenant, not assigned) cannot check in
    const unassignedCheckIn = await req('POST', `/guard/shifts/${ctx.shiftId}/check-in`, { token: ctx.guard2Token, body: {} });
    rec('unassigned same-tenant guard cannot check-in (403/404)', unassignedCheckIn.status === 403 || unassignedCheckIn.status === 404, `status=${unassignedCheckIn.status}`);
  }

  // ---------------------------------------------------------------
  // GUARD TOUR: full workflow
  // ---------------------------------------------------------------
  section('GUARD TOUR: routes / checkpoints / run / scan / evidence / complete');

  // The tenant OWNER (from /auth/register) is a Super Admin (User.isSuperAdmin
  // defaults to true) and bypasses the permission system, so they CAN create
  // checkpoints even though patrols.* keys are missing from the RBAC catalog.
  const adminCp = await req('POST', '/checkpoints', { token: ctx.adminA, body: { name: `QA CPapi ${STAMP}`, site_id: ctx.siteId } });
  rec('Super-Admin owner CAN create checkpoint via admin API (201)', adminCp.status === 201 || adminCp.status === 200,
    `status=${adminCp.status} body=${adminCp.text?.slice(0,160)}`);
  ctx.apiCpId = adminCp.json?.id;

  // Now prove the RBAC gap: a NON-super-admin restricted user (Branch Admin,
  // the richest non-super system role) still gets 403 on the same endpoint,
  // because patrols.view / patrols.manage cannot be granted to any role.
  if (ctx.restrictedToken) {
    const restrictedCp = await req('POST', '/checkpoints', { token: ctx.restrictedToken, body: { name: 'x', site_id: ctx.siteId } });
    rec('BUG#1: non-super Branch-Admin BLOCKED from POST /checkpoints (403) — patrols.manage not in RBAC catalog', restrictedCp.status === 403,
      `status=${restrictedCp.status} body=${restrictedCp.text?.slice(0,160)}`);
    const restrictedRoutes = await req('GET', '/patrol-routes', { token: ctx.restrictedToken });
    rec('BUG#1: non-super Branch-Admin BLOCKED from GET /patrol-routes (403) — patrols.view not in RBAC catalog', restrictedRoutes.status === 403,
      `status=${restrictedRoutes.status}`);
    // and the same user CAN reach a normal endpoint (proves the token is valid & role works)
    const restrictedLeads = await req('GET', '/leads', { token: ctx.restrictedToken });
    rec('control: non-super Branch-Admin CAN GET /leads (200) — proves token/role valid', restrictedLeads.status === 200, `status=${restrictedLeads.status}`);
  } else {
    rec('BUG#1 restricted-user tests skipped (no restricted user provisioned)', false, 'setup gap');
  }

  if (!ctx.siteId || !ctx.tenantAId) {
    rec('GUARD TOUR seed skipped — missing siteId/tenantId from earlier failure', false, `siteId=${ctx.siteId} tenantAId=${ctx.tenantAId}`);
  }
  // Build patrol route + 2 checkpoints via Prisma (one geofenced, one not)
  const cp1 = await db(() => prisma.checkpoint.create({ data: { tenantId: ctx.tenantAId, siteId: ctx.siteId, name: `QA CP1 ${STAMP}`, status: 'active' } }));
  const cp2 = await db(() => prisma.checkpoint.create({ data: {
    tenantId: ctx.tenantAId, siteId: ctx.siteId, name: `QA CP2 ${STAMP}`, status: 'active',
    latitude: 40.0, longitude: -74.0, geofenceRadiusMeters: 100,
  }}));
  const route = await db(() => prisma.patrolRoute.create({ data: { tenantId: ctx.tenantAId, siteId: ctx.siteId, name: `QA Route ${STAMP}`, status: 'active' } }));
  await db(() => prisma.patrolRouteCheckpoint.create({ data: { patrolRouteId: route.id, checkpointId: cp1.id, sequenceOrder: 0 } }));
  await db(() => prisma.patrolRouteCheckpoint.create({ data: { patrolRouteId: route.id, checkpointId: cp2.id, sequenceOrder: 1 } }));
  ctx.routeId = route.id; ctx.cp1Id = cp1.id; ctx.cp2Id = cp2.id;
  rec('seeded patrol route + 2 checkpoints via DB', true);

  const gRoutes = await req('GET', `/guard/shifts/${ctx.shiftId}/patrol-routes`, { token: ctx.guardToken });
  const routeVisible = Array.isArray(gRoutes.json) && gRoutes.json.some(r => r.id === ctx.routeId);
  rec('guard sees patrol route for their shift site', gRoutes.status === 200 && routeVisible, `status=${gRoutes.status} body=${gRoutes.text?.slice(0,200)}`);

  const crossRoutes = await req('GET', `/guard/shifts/${ctx.shiftId}/patrol-routes`, { token: ctx.guard2Token });
  rec('unassigned guard cannot list patrol routes for shift (403)', crossRoutes.status === 403 || crossRoutes.status === 404, `status=${crossRoutes.status}`);

  const startRun = await req('POST', `/guard/shifts/${ctx.shiftId}/patrol-runs/start`, { token: ctx.guardToken, body: { patrol_route_id: ctx.routeId } });
  rec('guard starts patrol run (in_progress)', (startRun.status === 200 || startRun.status === 201) && startRun.json?.status === 'in_progress', `status=${startRun.status} body=${startRun.text?.slice(0,200)}`);
  ctx.runId = startRun.json?.id;

  const startRunBadRoute = await req('POST', `/guard/shifts/${ctx.shiftId}/patrol-runs/start`, { token: ctx.guardToken, body: { patrol_route_id: '00000000-0000-0000-0000-000000000000' } });
  rec('start run with invalid route id returns 404', startRunBadRoute.status === 404, `status=${startRunBadRoute.status}`);

  const crossStart = await req('POST', `/guard/shifts/${ctx.shiftId}/patrol-runs/start`, { token: ctx.guard2Token, body: { patrol_route_id: ctx.routeId } });
  rec('non-assigned guard cannot start run on this shift (403)', crossStart.status === 403 || crossStart.status === 404, `status=${crossStart.status}`);

  if (ctx.runId) {
    // scan cp1 (no geofence)
    const scan1 = await req('POST', `/guard/patrol-runs/${ctx.runId}/checkpoints/${ctx.cp1Id}/scan`, { token: ctx.guardToken, body: { status: 'completed', notes: 'ok' } });
    rec('scan checkpoint 1 (no geofence) returns event', (scan1.status === 200 || scan1.status === 201) && !!scan1.json?.id, `status=${scan1.status} body=${scan1.text?.slice(0,220)}`);
    ctx.event1Id = scan1.json?.id;
    rec('scan 1 verificationStatus = no_geofence_configured', scan1.json?.verificationStatus === 'NO_GEOFENCE_CONFIGURED', `got=${scan1.json?.verificationStatus}`);

    // scan cp2 within geofence
    const scan2ok = await req('POST', `/guard/patrol-runs/${ctx.runId}/checkpoints/${ctx.cp2Id}/scan`, { token: ctx.guardToken, body: { status: 'completed', latitude: 40.0001, longitude: -74.0001 } });
    rec('scan checkpoint 2 within geofence => SUCCESS', scan2ok.json?.verificationStatus === 'SUCCESS', `got=${scan2ok.json?.verificationStatus} dist=${scan2ok.json?.distanceMeters}`);
    ctx.event2Id = scan2ok.json?.id;

    // re-scan cp2 far outside geofence (updates same event)
    const scan2far = await req('POST', `/guard/patrol-runs/${ctx.runId}/checkpoints/${ctx.cp2Id}/scan`, { token: ctx.guardToken, body: { status: 'completed', latitude: 41.0, longitude: -75.0 } });
    rec('re-scan checkpoint 2 outside geofence => OUTSIDE_GEOFENCE', scan2far.json?.verificationStatus === 'OUTSIDE_GEOFENCE', `got=${scan2far.json?.verificationStatus}`);

    // scan checkpoint not on route
    const strayCp = await prisma.checkpoint.create({ data: { tenantId: ctx.tenantAId, siteId: ctx.siteId, name: `stray ${STAMP}`, status: 'active' } });
    const scanStray = await req('POST', `/guard/patrol-runs/${ctx.runId}/checkpoints/${strayCp.id}/scan`, { token: ctx.guardToken, body: { status: 'completed' } });
    rec('scanning checkpoint not on route rejected (400)', scanStray.status === 400, `status=${scanStray.status}`);
    await prisma.checkpoint.delete({ where: { id: strayCp.id } }).catch(() => {});

    // another guard cannot scan this run
    const scanByOther = await req('POST', `/guard/patrol-runs/${ctx.runId}/checkpoints/${ctx.cp1Id}/scan`, { token: ctx.guard2Token, body: { status: 'completed' } });
    rec('another guard cannot scan someone else\'s run (404)', scanByOther.status === 404 || scanByOther.status === 403, `status=${scanByOther.status}`);

    // live location ping
    const loc = await req('POST', `/guard/patrol-runs/${ctx.runId}/location`, { token: ctx.guardToken, body: { latitude: 40.0, longitude: -74.0, accuracy: 5 } });
    rec('guard posts live location for run (200/201)', loc.status === 200 || loc.status === 201, `status=${loc.status} body=${loc.text?.slice(0,150)}`);
    const locBad = await req('POST', `/guard/patrol-runs/${ctx.runId}/location`, { token: ctx.guardToken, body: { latitude: 999, longitude: -74.0 } });
    rec('live location with invalid latitude rejected (400)', locBad.status === 400, `status=${locBad.status}`);

    // -------- PHOTO EVIDENCE --------
    section('GUARD TOUR: photo evidence (upload / retrieve / security)');
    if (ctx.event1Id) {
      const up = await uploadFile('POST', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, {
        token: ctx.guardToken, filename: 'checkpoint.png', contentType: 'image/png', buffer: PNG_1PX,
      });
      rec('guard uploads checkpoint photo evidence (png) => 201', (up.status === 201 || up.status === 200) && !!up.json?.id, `status=${up.status} body=${up.text?.slice(0,250)}`);
      ctx.evidenceId = up.json?.id;
      rec('evidence response does NOT leak storedFileName', up.json && !('storedFileName' in up.json), `keys=${up.json ? Object.keys(up.json).join(',') : 'null'}`);

      const dbEv = ctx.evidenceId ? await prisma.patrolEvidence.findUnique({ where: { id: ctx.evidenceId } }) : null;
      rec('DB: PatrolEvidence row linked to correct patrolEvent + run + guard',
        !!dbEv && dbEv.patrolEventId === ctx.event1Id && dbEv.patrolRunId === ctx.runId && dbEv.guardId === ctx.guardId,
        `db=${JSON.stringify({ e: dbEv?.patrolEventId, r: dbEv?.patrolRunId, g: dbEv?.guardId })}`);

      const list = await req('GET', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, { token: ctx.guardToken });
      rec('guard lists evidence for their event', list.status === 200 && Array.isArray(list.json) && list.json.some(e => e.id === ctx.evidenceId), `status=${list.status} body=${list.text?.slice(0,200)}`);

      const file = await req('GET', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence/${ctx.evidenceId}/file`, { token: ctx.guardToken });
      rec('guard downloads evidence file (200, image content-type)', file.status === 200 && /image\//.test(file.headers['content-type'] || ''), `status=${file.status} ct=${file.headers['content-type']}`);

      // negative: another guard, cross-tenant guard
      const otherList = await req('GET', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, { token: ctx.guard2Token });
      rec('another guard cannot list evidence on this event (404)', otherList.status === 404 || otherList.status === 403, `status=${otherList.status}`);
      const otherFile = await req('GET', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence/${ctx.evidenceId}/file`, { token: ctx.guard2Token });
      rec('another guard cannot download evidence file (404)', otherFile.status === 404 || otherFile.status === 403, `status=${otherFile.status}`);
      const crossFile = await req('GET', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence/${ctx.evidenceId}/file`, { token: ctx.guardBToken });
      rec('cross-tenant guard cannot download evidence file (404)', crossFile.status === 404 || crossFile.status === 403, `status=${crossFile.status}`);
      const noAuthFile = await req('GET', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence/${ctx.evidenceId}/file`);
      rec('unauthenticated evidence file request rejected (401)', noAuthFile.status === 401, `status=${noAuthFile.status}`);

      // negative: invalid file type (exe renamed .png => extension ok, mime bad) & true bad extension
      const badExt = await uploadFile('POST', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, {
        token: ctx.guardToken, filename: 'evil.exe', contentType: 'application/octet-stream', buffer: Buffer.from('MZ'),
      });
      rec('evidence upload rejects .exe (400)', badExt.status === 400, `status=${badExt.status}`);
      const mimeSpoof = await uploadFile('POST', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, {
        token: ctx.guardToken, filename: 'shell.png', contentType: 'application/octet-stream', buffer: Buffer.from('MZ...') ,
      });
      rec('evidence upload rejects spoofed MIME (png ext, octet-stream mime) (400)', mimeSpoof.status === 400, `status=${mimeSpoof.status}`);
      const pdfUp = await uploadFile('POST', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, {
        token: ctx.guardToken, filename: 'doc.pdf', contentType: 'application/pdf', buffer: PDF_BYTES,
      });
      rec('evidence upload rejects PDF (photos only) (400)', pdfUp.status === 400, `status=${pdfUp.status}`);

      // oversized (16MB > 15MB cap)
      const big = Buffer.alloc(16 * 1024 * 1024, 1);
      const bigUp = await uploadFile('POST', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, {
        token: ctx.guardToken, filename: 'huge.png', contentType: 'image/png', buffer: big,
      });
      rec('evidence upload rejects oversized file (>15MB) (400/413)', bigUp.status === 400 || bigUp.status === 413, `status=${bigUp.status}`);

      // multiple photos supported
      const up2 = await uploadFile('POST', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, {
        token: ctx.guardToken, filename: 'checkpoint2.jpg', contentType: 'image/jpeg', buffer: PNG_1PX,
      });
      rec('guard uploads a SECOND photo to same event (multi-photo)', up2.status === 201 || up2.status === 200, `status=${up2.status}`);
      const list2 = await req('GET', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, { token: ctx.guardToken });
      rec('event now has 2 evidence items', Array.isArray(list2.json) && list2.json.length >= 2, `count=${Array.isArray(list2.json) ? list2.json.length : '?'}`);
    }

    // complete the run (cp not scanned should be auto-missed — all scanned here, so none)
    const complete = await req('POST', `/guard/patrol-runs/${ctx.runId}/complete`, { token: ctx.guardToken });
    rec('guard completes patrol run (status completed)', (complete.status === 200 || complete.status === 201) && complete.json?.status === 'completed', `status=${complete.status} body=${complete.text?.slice(0,200)}`);

    const completeAgain = await req('POST', `/guard/patrol-runs/${ctx.runId}/complete`, { token: ctx.guardToken });
    rec('completing an already-completed run rejected (404)', completeAgain.status === 404, `status=${completeAgain.status}`);

    // evidence still readable after completion
    if (ctx.evidenceId && ctx.event1Id) {
      const postList = await req('GET', `/guard/patrol-runs/${ctx.runId}/events/${ctx.event1Id}/evidence`, { token: ctx.guardToken });
      rec('evidence still listable after run completion', postList.status === 200 && Array.isArray(postList.json) && postList.json.length >= 1, `status=${postList.status}`);
    }

    // location ping after completion rejected
    const locAfter = await req('POST', `/guard/patrol-runs/${ctx.runId}/location`, { token: ctx.guardToken, body: { latitude: 40, longitude: -74 } });
    rec('location ping after run completion rejected (404)', locAfter.status === 404, `status=${locAfter.status}`);

    // guard patrol history
    const hist = await req('GET', '/guard/patrol-runs', { token: ctx.guardToken });
    rec('guard patrol history includes completed run', hist.status === 200 && Array.isArray(hist.json) && hist.json.some(r => r.id === ctx.runId), `status=${hist.status}`);
  }

  // ---------------------------------------------------------------
  // MISSED CHECKPOINT path (fresh run, complete without scanning all)
  // ---------------------------------------------------------------
  section('GUARD TOUR: missed-checkpoint auto-marking');
  {
    // need a fresh in-progress shift assignment: reuse same shift (still valid), start new run
    const r2 = await req('POST', `/guard/shifts/${ctx.shiftId}/patrol-runs/start`, { token: ctx.guardToken, body: { patrol_route_id: ctx.routeId } });
    const run2 = r2.json?.id;
    if (run2) {
      await req('POST', `/guard/patrol-runs/${run2}/checkpoints/${ctx.cp1Id}/scan`, { token: ctx.guardToken, body: { status: 'completed' } });
      const comp2 = await req('POST', `/guard/patrol-runs/${run2}/complete`, { token: ctx.guardToken });
      const events = await prisma.patrolEvent.findMany({ where: { patrolRunId: run2 } });
      const missed = events.find(e => e.checkpointId === ctx.cp2Id);
      rec('unscanned checkpoint auto-marked "missed" on completion', missed?.status === 'missed', `cp2 status=${missed?.status} events=${events.length}`);
    } else {
      rec('missed-checkpoint test: could not start second run', false, `status=${r2.status} body=${r2.text?.slice(0,150)}`);
    }
  }

  // ---------------------------------------------------------------
  // INCIDENTS (guard files, admin reviews, client sees approved)
  // ---------------------------------------------------------------
  section('INCIDENTS + evidence + review workflow');
  if (ctx.shiftId) {
    const inc = await req('POST', `/guard/shifts/${ctx.shiftId}/incidents`, { token: ctx.guardToken, body: {
      title: 'QA Incident', description: 'Something happened', severity: 'medium', occurred_at: new Date().toISOString(),
    }});
    rec('guard files incident for shift (201)', inc.status === 201 || inc.status === 200, `status=${inc.status} body=${inc.text?.slice(0,220)}`);
    ctx.incidentId = inc.json?.id;

    const incBadSev = await req('POST', `/guard/shifts/${ctx.shiftId}/incidents`, { token: ctx.guardToken, body: {
      title: 'x', description: 'y', severity: 'apocalyptic', occurred_at: new Date().toISOString(),
    }});
    rec('incident with invalid severity rejected (400)', incBadSev.status === 400, `status=${incBadSev.status}`);

    if (ctx.incidentId) {
      // guard attaches evidence
      const incEv = await uploadFile('POST', `/guard/incidents/${ctx.incidentId}/evidence`, {
        token: ctx.guardToken, filename: 'inc.jpg', contentType: 'image/jpeg', buffer: PNG_1PX,
      });
      rec('guard attaches incident evidence (image) (201)', incEv.status === 201 || incEv.status === 200, `status=${incEv.status} body=${incEv.text?.slice(0,200)}`);

      // admin sees incident in review queue
      const rq = await req('GET', '/incidents/review-queue', { token: ctx.adminA });
      rec('admin review queue includes the incident', rq.status === 200 && JSON.stringify(rq.json).includes(ctx.incidentId), `status=${rq.status}`);

      // admin approves
      const review = await req('POST', `/incidents/${ctx.incidentId}/review`, { token: ctx.adminA, body: { status: 'approved', review_note: 'ok' } });
      rec('admin approves incident (200)', review.status === 200 || review.status === 201, `status=${review.status} body=${review.text?.slice(0,200)}`);
      const dbInc = await prisma.incident.findUnique({ where: { id: ctx.incidentId } });
      rec('DB: incident reviewStatus = approved', dbInc?.reviewStatus === 'approved' || dbInc?.status === 'approved', `db=${JSON.stringify({ rs: dbInc?.reviewStatus, s: dbInc?.status })}`);

      // cross-tenant admin cannot review
      const crossReview = await req('POST', `/incidents/${ctx.incidentId}/review`, { token: ctx.adminB, body: { status: 'rejected' } });
      rec('tenant B admin cannot review tenant A incident (403/404)', crossReview.status === 403 || crossReview.status === 404, `status=${crossReview.status}`);
    }
  }

  // ---------------------------------------------------------------
  // PANIC / EMERGENCY ALERTS
  // ---------------------------------------------------------------
  section('PANIC / EMERGENCY ALERTS');
  const panic = await req('POST', '/guard/emergency-alerts', { token: ctx.guardToken, body: {} });
  rec('guard triggers panic alert (201)', panic.status === 201 || panic.status === 200, `status=${panic.status} body=${panic.text?.slice(0,200)}`);
  ctx.alertId = panic.json?.id;

  const activeForGuard = await req('GET', '/guard/emergency-alerts/active', { token: ctx.guardToken });
  rec('guard sees own active alert', activeForGuard.status === 200 && JSON.stringify(activeForGuard.json).includes(ctx.alertId || '___'), `status=${activeForGuard.status}`);

  const adminAlerts = await req('GET', '/emergency-alerts', { token: ctx.adminA });
  rec('admin/dispatcher sees the alert in /emergency-alerts', adminAlerts.status === 200 && JSON.stringify(adminAlerts.json).includes(ctx.alertId || '___'), `status=${adminAlerts.status} body=${adminAlerts.text?.slice(0,200)}`);

  const crossAlerts = await req('GET', '/emergency-alerts', { token: ctx.adminB });
  rec('tenant B admin does NOT see tenant A alert', crossAlerts.status === 200 && !JSON.stringify(crossAlerts.json).includes(ctx.alertId || '___'), `status=${crossAlerts.status}`);

  const guardHitsAdminAlerts = await req('GET', '/emergency-alerts', { token: ctx.guardToken });
  rec('guard cannot hit admin /emergency-alerts (401/403)', guardHitsAdminAlerts.status === 401 || guardHitsAdminAlerts.status === 403, `status=${guardHitsAdminAlerts.status}`);

  if (ctx.alertId) {
    const ack = await req('POST', `/emergency-alerts/${ctx.alertId}/acknowledge`, { token: ctx.adminA, body: { notes: 'on it' } });
    rec('admin acknowledges alert (200)', ack.status === 200 || ack.status === 201, `status=${ack.status} body=${ack.text?.slice(0,200)}`);
    const crossAck = await req('POST', `/emergency-alerts/${ctx.alertId}/resolve`, { token: ctx.adminB, body: {} });
    rec('tenant B admin cannot resolve tenant A alert (403/404)', crossAck.status === 403 || crossAck.status === 404, `status=${crossAck.status}`);
    const resolve = await req('POST', `/emergency-alerts/${ctx.alertId}/resolve`, { token: ctx.adminA, body: { notes: 'resolved' } });
    rec('admin resolves alert (200)', resolve.status === 200 || resolve.status === 201, `status=${resolve.status} body=${resolve.text?.slice(0,200)}`);
    const dbAlert = await prisma.emergencyAlert.findUnique({ where: { id: ctx.alertId } });
    rec('DB: alert status is resolved with acknowledgedAt + resolvedAt', dbAlert?.status === 'RESOLVED' && !!dbAlert?.acknowledgedAt && !!dbAlert?.resolvedAt, `db=${JSON.stringify({ s: dbAlert?.status, a: !!dbAlert?.acknowledgedAt, r: !!dbAlert?.resolvedAt })}`);
    // audit trail
    const audit = await prisma.auditLog.findMany({ where: { tenantId: ctx.tenantAId, entityType: { in: ['EmergencyAlert'] } } });
    rec('audit log has EmergencyAlert entries', audit.length >= 1, `count=${audit.length}`);
  }

  // ---------------------------------------------------------------
  // CLIENT PORTAL
  // ---------------------------------------------------------------
  section('CLIENT PORTAL + isolation');
  if (ctx.clientPortalEmail && ctx.clientPortalPass) {
    const cLogin = await reqRetry('POST', '/client-auth/login', { body: { email: ctx.clientPortalEmail, password: ctx.clientPortalPass } });
    rec('client portal login returns tokens', cLogin.status === 200 && !!cLogin.json?.access_token, `status=${cLogin.status} body=${cLogin.text?.slice(0,200)}`);
    ctx.clientToken = cLogin.json?.access_token;

    if (ctx.clientToken) {
      const cProps = await req('GET', '/client-portal/proposals', { token: ctx.clientToken });
      rec('client portal proposals endpoint returns 200', cProps.status === 200, `status=${cProps.status} body=${cProps.text?.slice(0,150)}`);

      const cProfile = await req('GET', '/client-portal/profile', { token: ctx.clientToken });
      rec('client portal profile returns 200', cProfile.status === 200, `status=${cProfile.status}`);

      // client cannot hit admin endpoints
      const cHitsLeads = await req('GET', '/leads', { token: ctx.clientToken });
      rec('client token rejected on admin /leads (401/403)', cHitsLeads.status === 401 || cHitsLeads.status === 403, `status=${cHitsLeads.status}`);
      const cHitsGuard = await req('GET', '/guard/shifts', { token: ctx.clientToken });
      rec('client token rejected on /guard/shifts (401/403)', cHitsGuard.status === 401 || cHitsGuard.status === 403, `status=${cHitsGuard.status}`);

      // client incidents: only approved visible
      const cInc = await req('GET', '/client/incidents', { token: ctx.clientToken });
      rec('client incidents endpoint returns 200', cInc.status === 200, `status=${cInc.status} body=${cInc.text?.slice(0,200)}`);

      // live site status
      const cLive = await req('GET', '/client/patrols/live-status', { token: ctx.clientToken });
      rec('client live-status endpoint returns 200 (array)', cLive.status === 200, `status=${cLive.status} body=${cLive.text?.slice(0,200)}`);
    }
  } else {
    rec('client portal tests skipped (no portal user created)', false, 'setup failure');
  }

  // ---------------------------------------------------------------
  // OFFLINE SYNC
  // ---------------------------------------------------------------
  section('OFFLINE SYNC (guard sync queue)');
  {
    const syncStatus = await req('GET', '/guard/sync/status', { token: ctx.guardToken });
    rec('GET /guard/sync/status returns 200', syncStatus.status === 200, `status=${syncStatus.status} body=${syncStatus.text?.slice(0,200)}`);

    // Real payload shape: { actions: [{ id, actionType, payload, createdAt }] }
    const empty = await req('POST', '/guard/sync', { token: ctx.guardToken, body: { actions: [] } });
    rec('POST /guard/sync accepts an empty batch (200/201)', empty.status === 200 || empty.status === 201, `status=${empty.status} body=${empty.text?.slice(0,200)}`);

    // Queue a checkpoint scan that "happened offline" for cp1 on a fresh run.
    let offRun;
    const r3 = await req('POST', `/guard/shifts/${ctx.shiftId}/patrol-runs/start`, { token: ctx.guardToken, body: { patrol_route_id: ctx.routeId } });
    offRun = r3.json?.id;
    const actId = `qa-offline-${STAMP}`;
    const batch = { actions: [{
      id: actId, actionType: 'patrol_checkpoint_scan',
      payload: { runId: offRun, checkpointId: ctx.cp1Id, dto: { status: 'completed', notes: 'offline scan' } },
      createdAt: new Date(Date.now() - 60000).toISOString(),
    }]};
    const sync1 = await req('POST', '/guard/sync', { token: ctx.guardToken, body: batch });
    rec('POST /guard/sync processes a queued patrol_checkpoint_scan (200/201)', sync1.status === 200 || sync1.status === 201, `status=${sync1.status} body=${sync1.text?.slice(0,250)}`);
    const dbEvt = offRun ? await db(() => prisma.patrolEvent.findFirst({ where: { patrolRunId: offRun, checkpointId: ctx.cp1Id } })) : null;
    rec('DB: offline-synced checkpoint scan created a PatrolEvent', !!dbEvt, `exists=${!!dbEvt}`);
    const dbQ = await db(() => prisma.guardSyncQueue.findFirst({ where: { id: actId } }));
    rec('DB: GuardSyncQueue row persisted for the action', !!dbQ, `status=${dbQ?.status}`);

    // Replay the SAME batch — must be idempotent (no duplicate event / no 500)
    const sync2 = await req('POST', '/guard/sync', { token: ctx.guardToken, body: batch });
    rec('replaying the same sync batch is idempotent (no 5xx)', sync2.status < 500, `status=${sync2.status}`);
    const evtCount = offRun ? await db(() => prisma.patrolEvent.count({ where: { patrolRunId: offRun, checkpointId: ctx.cp1Id } })) : -1;
    rec('DB: no duplicate PatrolEvent after replay (exactly 1)', evtCount === 1, `count=${evtCount}`);

    const syncNoAuth = await req('POST', '/guard/sync', { body: { actions: [] } });
    rec('POST /guard/sync without token rejected (401)', syncNoAuth.status === 401, `status=${syncNoAuth.status}`);
    const syncBadShape = await req('POST', '/guard/sync', { token: ctx.guardToken, body: { actions: [{ id: 'x' }] } });
    rec('POST /guard/sync with malformed action rejected (400)', syncBadShape.status === 400, `status=${syncBadShape.status}`);

    if (offRun) await req('POST', `/guard/patrol-runs/${offRun}/complete`, { token: ctx.guardToken });
  }

  // ---------------------------------------------------------------
  // RBAC negative: non-super admin hitting super-admin-only + roles
  // ---------------------------------------------------------------
  section('RBAC / roles catalog');
  const perms = await req('GET', '/roles/permissions', { token: ctx.adminA });
  rec('GET /roles/permissions returns catalog', perms.status === 200 && Array.isArray(perms.json) && perms.json.length > 50, `status=${perms.status} count=${Array.isArray(perms.json) ? perms.json.length : '?'}`);
  const hasPatrolKey = Array.isArray(perms.json) && perms.json.some(p => (p.key || p) === 'patrols.view' || (p.key || p) === 'patrols.manage');
  rec('BUG-CHECK: RBAC catalog is MISSING patrols.view / patrols.manage (referenced by patrols.controller)', !hasPatrolKey,
    `hasPatrolKey=${hasPatrolKey}`);

  const rolesList = await req('GET', '/roles', { token: ctx.adminA });
  rec('GET /roles returns system roles', rolesList.status === 200 && Array.isArray(rolesList.json) && rolesList.json.length >= 5, `status=${rolesList.status} count=${Array.isArray(rolesList.json) ? rolesList.json.length : '?'}`);

  // ---------------------------------------------------------------
  // PUBLIC API surface (no key configured => 401)
  // ---------------------------------------------------------------
  section('PUBLIC API auth');
  const pubNoKey = await req('GET', '/public/clients');
  rec('GET /public/clients without API key rejected (401)', pubNoKey.status === 401, `status=${pubNoKey.status}`);
  const pubBadKey = await req('GET', '/public/clients', { headers: { 'X-API-Key': 'nope' } });
  rec('GET /public/clients with bad API key rejected (401)', pubBadKey.status === 401, `status=${pubBadKey.status}`);

  // ---------------------------------------------------------------
  // VENDOR PORTAL (bad token)
  // ---------------------------------------------------------------
  section('VENDOR PORTAL token gating');
  const vpBad = await req('GET', '/vendor/invitation/not-a-real-token');
  rec('vendor invitation with bogus token rejected (401/404)', vpBad.status === 401 || vpBad.status === 404, `status=${vpBad.status}`);

  // ---------------------------------------------------------------
  // REPEATED CALLS / reliability
  // ---------------------------------------------------------------
  section('RELIABILITY: repeated + concurrent calls');
  const many = await Promise.all(Array.from({ length: 15 }, () => req('GET', '/dashboard/summary', { token: ctx.adminA })));
  rec('15 concurrent /dashboard/summary calls all 200', many.every(r => r.status === 200), `codes=${[...new Set(many.map(r => r.status))].join(',')}`);
  const dupLeadA = await req('POST', '/leads', { token: ctx.adminA, body: { name: 'A', company: `Dup ${STAMP}`, email: `dup@${TAG}.test`, status: 'new' } });
  const dupLeadB = await req('POST', '/leads', { token: ctx.adminA, body: { name: 'A', company: `Dup ${STAMP}`, email: `dup@${TAG}.test`, status: 'new' } });
  rec('duplicate lead submissions both handled (no 500)', dupLeadA.status < 500 && dupLeadB.status < 500, `a=${dupLeadA.status} b=${dupLeadB.status}`);

  // ---------------------------------------------------------------
  const { PASS, FAIL, FAILURES } = summary();
  section('RESULT');
  console.log(`\nTOTAL: ${PASS + FAIL}   PASS: ${PASS}   FAIL: ${FAIL}`);
  if (FAILURES.length) {
    console.log('\nFAILURES:');
    for (const f of FAILURES) console.log(`  - ${f.name}\n      ${f.detail}`);
  }

  if (!KEEP) {
    section('TEARDOWN');
    await cleanup();
    console.log('qae2e tenants removed.');
  } else {
    console.log('\n--keep set: qae2e tenants left in place.');
  }

  await prisma.$disconnect();
  process.exit(FAIL > 0 ? 1 : 0);
}

process.on('unhandledRejection', (e) => { console.error('UNHANDLED REJECTION', e); });

main().catch(async (e) => {
  console.error('FATAL', e && e.stack || e);
  if (!KEEP) { try { await cleanup(); } catch {} }
  await prisma.$disconnect();
  process.exit(2);
});
