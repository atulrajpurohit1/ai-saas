[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# AI Features

This domain covers every feature in the platform that carries an "AI" label. Because clients need to know exactly what they are paying for, **each feature below states plainly whether it makes a real call to Google Gemini (or, for transcription, OpenAI Whisper), whether it is deterministic rule-based logic, or a blend of both** — and what happens when the AI provider is slow, misconfigured, or unavailable.

**Shared architecture note:** almost every AI-flavored feature is built on one shared backend service, `AiService` (`backend/src/ai/ai.service.ts`), which wraps a single Google Gemini client (`@google/generative-ai`, model configurable via `GEMINI_MODEL`, default `gemini-2.5-flash`). A feature only gets real LLM output if `GEMINI_API_KEY` is set and the Gemini call succeeds. Two independent fallback patterns exist in the codebase:
- **Gated fallback** (used by proposal drafting, sales assessment/discovery/outreach prompts inside `AiService` itself): if Gemini is unavailable or fails, the method returns a canned/templated response **only if** the `ENABLE_AI_FALLBACK` environment variable is `"true"`; otherwise it throws an error.
- **Silent rule-based fallback** (used by AI Insights, AI Revenue Intelligence, AI Copilot, and the Sales Accelerator's discovery/coaching calls): the calling service always tries Gemini first, and if it fails or Gemini is not configured, it quietly substitutes a rule-based/deterministic answer computed from real tenant data — the user is never blocked, but the output may not be genuine LLM prose that day.

Every generation that runs through the shared monitoring layer (`AiMonitoringService.logGeneration`) is stamped with a `status` (`success` / `fallback` / `failed`) and a `fallbackUsed` boolean, and screened for safety by AI Governance — that stamped record is what lets this document (and the in-app AI Audit screen) state honestly which outputs were real model calls.

---

# 20. AI Proposal Drafting

## Purpose
Lets a sales rep or admin generate a full, professional security-services proposal document for a lead in seconds, instead of writing one from scratch.

## Overview
From a lead's record, one click asks Gemini to write a structured Markdown proposal (Executive Summary, Scope of Work, Staffing & Deployment, Pricing placeholder, etc.) using the lead's name, company, status, notes, and related deals as context. The result is saved as a normal, editable Proposal record with full version history, and can be exported to PDF or shared with the client portal.

## What User Can Do
- Generate an AI proposal draft for a single lead
- Bulk-generate proposals for every lead that doesn't already have one
- Edit the generated content afterward like any other proposal (each edit is versioned)
- Export the proposal to a branded PDF
- Share the proposal with a client for portal review

## Workflow
```
Admin opens a lead and clicks "Generate Proposal"
        ↓
Backend assembles lead context (name, company, status, notes, deals)
        ↓
A fixed prompt template is sent to Google Gemini
        ↓
Gemini returns a structured Markdown proposal
        ↓
Draft is saved as a new Proposal (status: draft) with version 1
        ↓
Admin edits/reviews, then shares with the client or exports to PDF
```

## Business Value
- Cuts proposal turnaround from hours to seconds for a first draft.
- Keeps proposal structure and tone consistent across the whole sales team.
- Bulk generation clears a backlog of proposal-less leads in one action.

## Technical Summary
- **Purpose:** produce a client-ready draft proposal from lead data.
- **Input:** lead name, company, status, up to a handful of related notes, and related deal names (`ProposalsService.generateForLead`); a second, simpler entry point (`AiController` → `POST /ai/proposal-draft`) accepts a manually-typed site name, guard count, requirements, and notes.
- **Processing:** a **real Gemini call is made** (`AiService.generateForLead` / `generateProposalDraft`) using a **fixed, hardcoded prompt template** — this prompt is not admin-editable and is not registered in AI Governance's prompt registry.
- **Output:** a Markdown-formatted proposal document saved as `Proposal.content`.
- **Prompt-generation approach:** fixed template only (no versioning/override available for this feature today).
- **Fallback behavior:** if Gemini is unavailable/fails and `ENABLE_AI_FALLBACK=true`, a short canned template proposal is returned instead (clearly labeled internally as a fallback); if the flag is off, the request fails with a 500 error rather than silently returning fake AI content.
- **Known limitations:** no AI Governance prompt versioning; pricing is always a placeholder (the AI is explicitly instructed not to invent numbers); this generation is not logged into the shared `AiGeneration` monitoring/audit table used by the other AI Insights-family features, so it does not appear in the AI Audit screen or AI Monitoring metrics.
- **Modules:** `proposals`, `ai` (shared `AiService`)
- **Database tables:** `Proposal`, `ProposalVersion`, `ProposalComment`
- **Frontend:** `/proposals` list/detail pages with "Generate", "Generate Bulk", edit, export-PDF, and share actions; embedded generation is also available from a lead's detail view.

## Key Capabilities
- Single-lead and bulk AI proposal generation
- Automatic version history on every content edit
- Branded PDF export
- Client-portal sharing with comment thread

## Current Status
**Fully Implemented.** This is a real, working Gemini integration end to end (UI → API → service → Gemini → database), with a defined (if basic) fallback path when Gemini is unavailable.

**[Insert Screenshot Here]**

---

# 21. AI Sales Assessment & Lead Scoring

## Purpose
Gives a sales rep an instant, structured read on how strong a lead or deal is — a 0–100 lead score, a priority tier, a close-readiness score, risk profile, and a recommended next action — instead of relying on gut feel.

## Overview
Whenever a rep runs scoring on a lead or deal, the system builds a text summary of everything known about it (status, notes, discovery answers, deal stage) and sends it to Gemini with instructions to return a structured JSON assessment. In parallel, the system **always** computes an equivalent rule-based heuristic score from the same data, so there is a numeric baseline even when the AI output is thin or missing. Every assessment is saved to the deal/lead's history so trend lines (is this deal getting more or less ready to close?) can be shown over time.

## What User Can Do
- Run "Score Lead" / "Score Deal" from a lead or deal's workspace
- View lead score, priority tier (high/medium/low), close-readiness score, discovery-quality score, risk profile, proposal angle, missing questions, and objection risks
- See assessment history and readiness trend per deal
- See top leads and at-risk deals surfaced automatically on the Sales Accelerator dashboard

## Workflow
```
Rep opens a lead or deal workspace and clicks "Score"
        ↓
System assembles context: lead/deal facts + latest discovery session
        ↓
A rule-based heuristic score is always computed first (safety baseline)
        ↓
The same context is sent to Gemini with a fixed prompt asking for structured JSON
        ↓
If Gemini succeeds, its scores/summary are used (merged with heuristic defaults
for any missing field); if it fails, the heuristic score is used as-is
        ↓
Assessment is saved to the lead/deal's history and shown in the workspace
```

## Business Value
- Gives reps and managers an objective, repeatable way to prioritize a pipeline instead of ad-hoc judgment.
- The always-on rule-based baseline means scoring never silently fails or returns nothing, even if Gemini is down.
- Historical assessments let a manager see whether coaching is actually improving deal readiness over time.

## Technical Summary
- **Purpose:** score and qualify a lead/deal, and generate a short risk/proposal narrative.
- **Input:** lead/deal identity fields, status/stage, recent notes, related proposal engagement, and the most recent `DiscoverySession` (if captured).
- **Processing:** a **real Gemini call is made** (`AiService.generateSalesAssessment`) with a fixed prompt requesting `leadScore`, `priorityTier`, `closeReadinessScore`, `discoveryQualityScore`, `riskProfile`, `proposalAngle`, `recommendedNextAction`, `missingQuestions`, `objectionRisks`, and `summary` as JSON. A **rule-based heuristic** (`ruleAssessment`) is computed independently every time and used to fill in any field Gemini omits or fails to return, and as the entire result if the Gemini call throws.
- **Output:** a `SalesAssessment` record with numeric scores, tier, and narrative text fields.
- **Prompt-generation approach:** fixed template only — not registered in AI Governance, so it cannot be edited or versioned by an admin today.
- **Fallback behavior:** silent rule-based fallback — the user is never blocked or shown an error; the record is stamped `fallbackUsed: true` internally when Gemini did not produce the result.
- **Data flow / logging:** every attempt is logged to `AiGeneration` via `AiMonitoringService.logGeneration` with `sourceModule: 'sales_accelerator'` and `promptKey: 'sales_assessment'`, so it is visible in the AI Governance audit trail.
- **Known limitations:** scores can differ meaningfully between an AI run and a rule-based fallback run on the same data, since they use different logic; there is no admin control over the prompt wording.
- **Modules:** `sales-accelerator`, `ai` (shared `AiService`), `ai-monitoring`
- **Database tables:** `SalesAssessment`, `DiscoverySession`, `AiGeneration`
- **Frontend:** embedded in the Sales Accelerator lead/deal workspace panel (`SalesAcceleratorPanel`) and summarized on `/sales-accelerator` dashboard (top leads, at-risk deals, forecast).

## Key Capabilities
- Lead and deal scoring with priority tiering
- Always-available rule-based scoring baseline (no hard failure mode)
- Assessment history and forecast/momentum tracking per deal
- Objection-risk and missing-question surfacing to guide the next conversation

## Current Status
**Fully Implemented.** A genuine hybrid: real Gemini scoring layered over a deterministic safety net, both feeding the same downstream dashboard and workspace views.

**[Insert Screenshot Here]**

---

# 22. AI Discovery Guide, Outreach & Call Intelligence

## Purpose
Coaches a sales rep through the entire discovery-to-outreach cycle: what to ask before a call, what to say during cold outreach, and what was actually learned from a completed call — including live, in-call coaching prompts.

## Overview
This is a family of related Gemini-backed generators inside the Sales Accelerator, all sharing the same lead/deal context but each producing a different kind of output: a discovery question guide, a cold-outreach script package (call opener, voicemail, email, gatekeeper strategy), a post-call intelligence extraction (from typed notes or a transcript), and a live in-call coaching assistant (next best question, missed questions, risk prompts) that can be re-run as notes accumulate during a call.

## What User Can Do
- Generate a discovery question guide for a lead or deal before a first call
- Generate a full outreach package (call opener, talking points, voicemail script, email subject/body, gatekeeper strategy, best call window, follow-up plan)
- Paste in call notes or a transcript and get back a structured "call intelligence" extraction (pain points, risk concerns, objections, decision makers, recommended next action, confidence score)
- Run a "live coach" pass mid-call that scores discovery completeness and suggests the next question to ask
- Feed a completed discovery straight into a discovery-based proposal draft

## Workflow
```
Rep opens the Sales Accelerator panel on a lead/deal
        ↓
Rep requests a Discovery Guide before the call → Gemini returns
tailored questions, talking points, and a qualification checklist
        ↓
(Optional) Rep requests an Outreach package for cold prospecting
        ↓
During/after the call, rep pastes notes or a transcript
        ↓
Rep runs "Analyze Call" → structured call intelligence extracted
   OR runs "Live Coach" → real-time next-question guidance
        ↓
Once discovery is complete, rep can generate a discovery-based proposal
```

## Business Value
- Standardizes discovery quality across the sales team instead of relying on rep experience.
- Turns unstructured call notes into structured, searchable data (pain points, objections, decision makers) usable for coaching and forecasting.
- Live coaching reduces the number of "we forgot to ask that" follow-up calls.

## Technical Summary
- **Purpose:** generate discovery questions, outreach scripts, and structured call analysis; provide live in-call coaching.
- **Input:** lead/deal context text plus (for call intelligence/live coach) admin-typed call notes or a transcript (see Call Transcription, feature 31, for how audio becomes that transcript text).
- **Processing:** each of the four sub-features makes a **real Gemini call** with its own fixed prompt (`AiService.generateDiscoveryGuide`, `generateOutreachPlan`, `generateDiscoveryCallIntelligence`, `generateDiscoveryLiveCoach`). Each has a **matching rule-based fallback** implemented independently in `SalesAcceleratorService` (`ruleDiscoveryGuide`, `ruleOutreachPlan`, `ruleDiscoveryCallIntelligence`, `ruleDiscoveryLiveCoach`) that pattern-matches keywords in the transcript text (e.g. regex for guard counts, risk words, timeline language) when Gemini fails.
- **Output:** structured JSON (arrays of questions/talking points/prompts, scripts, or scored discovery fields), always returned in the same shape whether AI- or rule-generated.
- **Prompt-generation approach:** fixed templates only — none of these prompt keys (`discovery_guide`, `outreach_plan`, `discovery_call_intelligence`, `discovery_live_coach`, `discovery_proposal`) appear in the AI Governance prompt registry, so none are admin-versionable today.
- **Fallback behavior:** silent — on any Gemini error the service logs a warning and substitutes the rule-based result; the caller always gets a usable response.
- **Data flow / logging:** every generation (AI or fallback) is logged to `AiGeneration` with `sourceModule: 'sales_accelerator'` and the relevant `promptKey`, so success/fallback rates are visible in the governance audit trail.
- **Known limitations:** the rule-based fallback quality is noticeably lower than genuine Gemini output (it is keyword/regex-based, not language understanding); minimum 20 characters of call notes are required before "Analyze Call" will run.
- **Modules:** `sales-accelerator`, `ai` (shared `AiService`)
- **Database tables:** `DiscoverySession`, `SalesAssessment`, `AiGeneration`
- **Frontend:** `SalesAcceleratorPanel` component embedded in lead/deal detail views; call notes/transcript entry and live-coach panel also usable from the dedicated `/sales-calls` page.

## Key Capabilities
- Pre-call discovery guide generation
- Cold-outreach script generation (call, voicemail, email, gatekeeper strategy)
- Post-call structured intelligence extraction from notes/transcript
- Live, re-runnable in-call coaching with a completeness score
- Direct hand-off into discovery-based proposal generation

## Current Status
**Fully Implemented.** All four generators are wired end-to-end with real Gemini calls and independently engineered rule-based fallbacks; this is one of the more sophisticated AI integrations in the platform.

**[Insert Screenshot Here]**

---

# 23. AI Copilot (Natural Language Q&A)

## Purpose
Lets an admin or finance user ask a plain-English question about their own business ("What's our overdue invoice total?", "Where do we have staffing shortages?") and get a direct answer grounded in their actual tenant data.

## Overview
The Copilot is a two-layer system. First, a **deterministic query engine** classifies the question by intent (billing, staffing, revenue, incidents, sites, clients, reports, or general) and computes a structured, factually-correct answer directly from the same data used by AI Insights and Revenue Intelligence. Second, that structured answer — plus a handful of relevant "organizational memory" entries pulled from the Knowledge Base — is optionally handed to Gemini to be rewritten into a more natural, conversational sentence. If Gemini is unavailable, the deterministic answer is shown as-is, so the Copilot never fails to answer a recognized question.

## What User Can Do
- Ask a free-text question in the Copilot chat
- See the answer along with which internal "sources" backed it up
- See suggested follow-up questions (tailored slightly for finance-role users)
- View past questions/answers (history)

## Workflow
```
User types a question into the Copilot
        ↓
System detects the question's intent (billing, staffing, revenue, etc.)
        ↓
A rule-based query engine computes a factual answer directly from tenant data
        ↓
Relevant Knowledge Base entries are retrieved for extra context
        ↓
The structured answer + context is optionally sent to Gemini to be phrased naturally
        ↓
Final answer, source list, and confidence score are shown and saved to history
```

## Business Value
- Answers common operational questions in seconds without navigating multiple dashboards.
- Because the underlying answer is always computed from real, live data (not just asked of the LLM directly), the Copilot cannot "hallucinate" numbers — the AI's only job is phrasing, not fact-finding.
- Builds a searchable history of what admins have been asking, useful for spotting recurring pain points.

## Technical Summary
- **Purpose:** answer natural-language operational questions using real tenant data.
- **Input:** the user's typed question; internally the system also draws on live Client/Guard/Site/Billing/Incident/Revenue aggregates and Knowledge Base entries.
- **Processing:** `CopilotQueryService.answerQuestion` (100% deterministic — keyword/regex intent detection, then direct database queries reusing AI Insights' and Revenue Intelligence's own computation methods) **always** runs first and always produces a usable answer. `AiService.generateCopilotAnswer` then makes a **real Gemini call**, passing the structured answer, its supporting context, and matching Knowledge Base entries, asking Gemini to phrase a concise natural-language answer without inventing facts.
- **Output:** an answer string, a `source` field explicitly marked `'ai_assisted'` or `'rule_based'` (visible in the API response), a confidence score, an intent label, and a list of source references.
- **Prompt-generation approach:** fixed template only (not in the AI Governance registry).
- **Fallback behavior:** if Gemini is unavailable or errors, `generateCopilotAnswer` returns `null` and the deterministic structured answer is shown verbatim — the Copilot **never** returns an error to the user for a recognized intent.
- **Data flow:** every question/answer pair is saved to `AiConversation`; asking and answering are both separately audit-logged.
- **Known limitations:** intent detection is regex/keyword-based, so oddly-phrased questions may be misclassified into the wrong intent bucket; there is no way for an admin to see or adjust the Gemini phrasing prompt.
- **Modules:** `ai-copilot` (`AiCopilotService`, `CopilotQueryService`), `ai` (shared `AiService`), `knowledge-base`
- **Database tables:** `AiConversation`, `KnowledgeEntry`
- **Frontend:** `/ai-copilot` chat page with suggested questions and conversation history.

## Key Capabilities
- Intent-classified natural-language Q&A across billing, staffing, revenue, incidents, sites, clients, and reports
- Deterministic, hallucination-resistant factual grounding
- Optional Gemini-polished phrasing with transparent AI-vs-rule-based labeling
- Knowledge Base-grounded context injection
- Conversation history

## Current Status
**Fully Implemented.** A well-engineered "retrieval + optional LLM polish" pattern rather than a raw chatbot — the factual core works with or without Gemini.

**[Insert Screenshot Here]**

---

# 24. AI Business Insights & Recommendations

## Purpose
Gives admins a single dashboard of what's going well and what needs attention across clients, guards, sites, billing, and incidents — with a prioritized action list.

## Overview
Every insight metric and every "insight card" (e.g. "Revenue concentration," "Missed shifts," "Highest incident rate") is computed by **deterministic threshold rules** reading directly from live Prisma data — there is no AI involved in deciding these facts. On top of that rule-based foundation, the dashboard optionally asks Gemini to propose **additional** recommendations, using the rule-based insights, admin feedback history, and relevant Knowledge Base entries as grounding context. Recommendations that admins have repeatedly rejected are automatically down-weighted (lower priority, lower confidence) the next time a similar one would appear.

## What User Can Do
- View client, guard, site, billing, and incident insight dashboards with headline metrics
- View a prioritized recommendation list (rule-based and, when available, AI-generated)
- View a dedicated incident-risk view (high-risk sites/clients/guards, recurring incident types, time-of-day patterns) with an AI-written or rule-based narrative summary
- Give thumbs-up/down feedback on any recommendation, which trains future recommendation weighting

## Workflow
```
Admin opens AI Insights
        ↓
System computes client/guard/site/billing metrics directly from live data (rule-based)
        ↓
System computes a rule-based recommendation list from those same metrics
        ↓
System optionally asks Gemini for extra recommendations, grounded in
rule-based insights + admin feedback history + Knowledge Base entries
        ↓
Recommendations that were previously rejected repeatedly are down-weighted
        ↓
Combined list is shown to the admin, who can rate each recommendation
```

## Business Value
- Surfaces problems (staffing shortages, revenue concentration risk, disputed invoices, high-incident sites) an admin might otherwise miss until it's too late.
- The rule-based foundation means the dashboard is always populated and trustworthy, even with Gemini switched off — the AI layer only adds extra suggestions, it never replaces the facts.
- The feedback loop means the recommendation engine genuinely gets more relevant to a specific tenant over time.

## Technical Summary
- **Purpose:** surface operational insights and a prioritized action list.
- **Input:** live Client/Guard/Site/Invoice/Incident data for the tenant (current month/90-day windows depending on the section); for the AI recommendation layer, the rule-based insight messages, current rule recommendations, admin feedback summary, and matching Knowledge Base entries.
- **Processing:** the insight metrics/cards themselves (`getClientInsights`, `getGuardInsights`, `getSiteInsights`, `getBillingInsights`, `getIncidentInsights`) are **100% rule-based** — thresholds and aggregation only, no LLM call. Two optional **real Gemini calls** exist on top: `AiService.generateBusinessInsightRecommendations` (extra recommendations) and `AiService.generateIncidentRiskSummary` (a narrative incident paragraph); both accept an admin-authored prompt override if one is active in AI Governance, otherwise use a fixed default prompt.
- **Output:** insight cards/metrics (always present), a merged recommendation list (rule-based + any AI-generated ones), and (for incidents) a summary paragraph.
- **Prompt-generation approach:** **governance-versioned** — `business_recommendations` and `incident_risk_summary` are both registered in AI Governance's prompt registry, so an admin can author and activate a custom prompt version for these two specifically (unlike most other AI features in this document).
- **Fallback behavior:** if the Gemini call fails or returns nothing, the dashboard simply shows the rule-based recommendations/summary alone (`source: 'rule_based'` is reported explicitly in the API response) — there is no user-visible error.
- **Data flow / logging:** every dashboard load and incident-insights load is logged to `AiGeneration`; recommendations get their feedback applied via `AiMonitoringService.applyFeedbackToRecommendations` before being returned.
- **Known limitations:** the "AI Insights" branding covers a mostly rule-based dashboard — the AI's contribution is limited to a handful of extra recommendations and one narrative paragraph, not the underlying analysis.
- **Modules:** `ai-insights` (`AiInsightsService`, `RecommendationService`), `ai`, `ai-monitoring`, `ai-governance`, `knowledge-base`
- **Database tables:** reads `Client`, `Guard`, `Site`, `Invoice`, `Incident`, `Shift`, `Assignment`, `AttendanceEvent`; writes `AiGeneration`
- **Frontend:** `/ai-insights` (overview), `/ai-insights/incidents` (incident risk detail); recommendation cards include a thumbs-up/down feedback control.

## Key Capabilities
- Client, guard, site, billing, and incident insight dashboards
- Rule-based recommendation engine (always available)
- Optional Gemini-generated supplemental recommendations and incident narrative, with admin-editable prompts via AI Governance
- Feedback-driven recommendation re-weighting
- Guard scheduling recommendations (a related capability in the same module — see `RecommendationService.recommendGuards`), which score and rank guards for a shift using the same rule-first/Gemini-explanation pattern

## Current Status
**Fully Implemented**, with the important caveat that most of what is shown is deterministic analytics — treat the "AI" label here as "AI-enhanced rule-based insights," not "AI-generated insights."

**[Insert Screenshot Here]**

---

# 25. AI Revenue Intelligence

## Purpose
Gives finance and leadership a forward-looking view of revenue: next month's forecast, contract health, client value trends, and renewal risk, plus a plain-English executive summary and recommended finance actions.

## Overview
The forecasting math itself — a 12-month revenue projection, contract health scoring, client value analysis, and renewal-window detection — is entirely rule-based, computed from real invoice, rate card, dispute, and incident history. Gemini is layered on top purely to (a) write an executive-readable narrative paragraph summarizing the numbers and (b) propose additional finance recommendations grounded in that same data plus admin feedback history and Knowledge Base entries.

## What User Can Do
- View a 12-month revenue forecast with a confidence rating
- View contract health scores per client (with risk indicators)
- View client value analysis (growth/decline trend per client)
- View upcoming renewal opportunities
- View AI/rule-generated financial recommendations
- Read an executive-style revenue summary paragraph

## Workflow
```
Admin opens AI Insights → Revenue
        ↓
System computes forecast, contract health, client value, and renewals
from real invoice/rate card/dispute/incident history (rule-based)
        ↓
System optionally asks Gemini for an executive summary paragraph and
additional finance recommendations, grounded in the rule-based output
        ↓
Combined forecast + narrative + recommendations are shown
```

## Business Value
- Gives finance leadership a forward-looking number instead of only historical reporting.
- Flags at-risk contracts and renewal timing before they become a surprise.
- The narrative layer turns a table of numbers into something that can be dropped straight into an executive update.

## Technical Summary
- **Purpose:** forecast revenue, assess contract/client health, and recommend finance actions.
- **Input:** invoices, rate cards, disputes, and incidents linked to clients, over rolling 90/180-day and 12-month windows.
- **Processing:** forecast math, contract health scoring, client value trend, and renewal detection (`RevenueInsightsService`) are **100% rule-based**. Two optional **real Gemini calls** run on top: `AiService.generateRevenueIntelligenceSummary` (narrative paragraph) and `AiService.generateRevenueFinancialRecommendations` (structured recommendation list), each accepting a governance-authored prompt override.
- **Output:** forecast numbers/confidence, contract health rows, client value rows, renewal rows (all rule-based and always present), plus an optional narrative paragraph and optional extra recommendations.
- **Prompt-generation approach:** **governance-versioned** — `revenue_summary` and `financial_recommendations` (both under module `ai_insights.revenue`) are registered in the AI Governance prompt registry and can be overridden by an admin.
- **Fallback behavior:** if Gemini fails or is unconfigured, the narrative/recommendation calls simply return `null`/empty, and the UI shows the rule-based forecast and rows without a narrative or extra recommendations — no error is surfaced.
- **Data flow / logging:** every load is logged to `AiGeneration`, feeding the same governance audit trail and monitoring metrics as AI Insights.
- **Known limitations:** as with AI Insights, the forecasting math itself is not AI-generated — only the narrative gloss and a handful of extra recommendations are; forecast accuracy depends entirely on how much invoice/rate-card history a tenant has accumulated.
- **Modules:** `ai-insights` (`RevenueInsightsService`), `ai`, `ai-monitoring`, `ai-governance`, `knowledge-base`
- **Database tables:** reads `Invoice`, `RateCard`, `InvoiceDispute`, `Incident`, `Client`; writes `AiGeneration`
- **Frontend:** `/ai-insights/revenue` page (forecast, contracts, client value, renewals, recommendations all in one view).

## Key Capabilities
- 12-month rule-based revenue forecast with confidence rating
- Contract health scoring and renewal-window detection
- Client value growth/decline analysis
- Gemini-generated executive narrative (governance-editable prompt)
- Gemini-generated supplemental finance recommendations (governance-editable prompt)

## Current Status
**Fully Implemented**, with the same honesty caveat as AI Insights: the forecast and health scores are deterministic finance math, not LLM output — Gemini only adds the narrative layer and a few extra suggestions.

**[Insert Screenshot Here]**

---

# 26. AI Governance (Prompt Versioning & Safety)

## Purpose
Gives an administrator control and oversight over what the AI is allowed to say: the ability to author and activate custom prompt wording for supported features, and an automatic safety net that screens every AI output for sensitive data or unsafe suggestions before it can be shown to a client.

## Overview
AI Governance has two jobs. First, **prompt versioning**: for a specific, limited set of AI capabilities (see below), an admin can write a new prompt version, save it as inactive, and later activate it — instantly changing what instructions Gemini receives for that capability, without a code deployment. Second, **safety screening**: every single AI generation that flows through the shared monitoring service is automatically scanned with pattern-matching rules for emails, SSNs, card numbers, phone numbers, unsafe automation language ("automatically terminate/charge/refund..."), and unsupported legal/financial claims — and blocked from client-visible approval if any high-severity finding is present.

## What User Can Do
- View all AI prompt "slots" the platform supports, and every version ever created for each
- Author a new prompt version for a supported slot and save it as inactive
- Activate a prompt version (deactivating the previous active one automatically)
- Deactivate a prompt version
- View the full AI generation audit log (last 100 entries), including prompt version used, fallback status, safety findings, and any feedback received
- Approve a client-visible AI output (blocked automatically if it failed the safety screen)

## Workflow
```
Admin opens Settings → AI Prompts
        ↓
Admin writes a new prompt version for a supported capability (e.g. "Revenue Recommendations")
        ↓
Admin activates the version → it immediately becomes the live prompt for that capability
        ↓
Next time that feature runs, Gemini receives the admin's custom instructions instead of the default
        ↓
Every generation is safety-screened automatically and logged to the AI Audit trail
        ↓
Admin can review the audit trail and approve any client-visible output that passed the safety check
```

## Business Value
- Lets a company tune AI tone/behavior for its own brand or industry niche without needing a code change.
- The automatic safety screen is a real compliance control, not a marketing claim — it actively blocks outputs containing PII patterns or unsafe automation language.
- Full audit trail supports "what did the AI say and when" review for compliance or dispute purposes.

## Technical Summary
- **Purpose:** prompt customization and safety/compliance oversight for AI outputs.
- **Input:** admin-authored prompt text (with `{{variable}}` placeholders resolved at generation time); every AI generation's output/input for safety scanning.
- **Processing:** this feature itself does **not** call Gemini — it manages what gets sent *to* Gemini (prompt text) and inspects what comes *back* (safety screening via regex pattern matching, not an AI classifier). Only **5 capabilities are registered** as governance-editable: `ai_insights.dashboard/business_recommendations`, `ai_insights.incident_risk/incident_risk_summary`, `ai_insights.revenue/revenue_summary`, `ai_insights.revenue/financial_recommendations`, and `ai_scheduling.guard_recommendations/guard_recommendation_explanation`. **Every other AI feature in this document (proposals, sales assessment/discovery/outreach, AI Copilot) uses a fixed, hardcoded prompt that cannot currently be edited through this screen.**
- **Output:** an active/inactive prompt version record per capability; a safety verdict (`passed` / `review_required` / `blocked`) and finding list attached to every `AiGeneration` row.
- **Fallback behavior:** if no active custom prompt exists for a governed capability, the feature's built-in default prompt template is used automatically — there is always a working prompt.
- **Known limitations:** safety screening is regex/pattern-based, not an AI-driven classifier, so it can miss cleverly-obfuscated sensitive data and can also false-positive (e.g. any 10+ digit sequence is flagged as a possible phone number); only 5 of the ~12 AI capabilities in this document are actually governable today.
- **Modules:** `ai-governance` (`AiGovernanceService`)
- **Database tables:** `PromptVersion`, `AiGeneration` (safety/approval fields)
- **Frontend:** `/ai-prompts` (versioning) and `/ai-audit` (generation log + approve action).

## Key Capabilities
- Versioned, activatable prompt overrides for 5 registered AI capabilities
- Automatic PII/unsafe-automation/legal-claim safety screening on every logged generation
- Approval workflow for client-visible AI output, blocked automatically on safety failure
- Full audit trail of prompt changes and AI generations

## Current Status
**Fully Implemented** for the capabilities it covers, but its reach is narrower than the "AI Governance" name implies — most AI features in the platform (proposal drafting, sales assessment, discovery/outreach, Copilot) are **not yet** prompt-governable; only the AI Insights/Revenue/Scheduling recommendation-and-narrative prompts are.

**[Insert Screenshot Here]**

---

# 27. AI Monitoring & Feedback

## Purpose
Intended to give an admin a quality dashboard for the AI itself: how often it succeeds vs. falls back vs. fails, how useful/accurate admins rate its output, and how well AI-suggested actions are being accepted — plus the actual mechanism for admins to submit that feedback.

## Overview
This feature is **two separable halves with very different levels of completeness**. The feedback **collection** half is fully real: admins can rate any AI recommendation or action (1–5 rating, useful/accurate flags, free-text comment), and that feedback is stored and actively used elsewhere in the platform (it feeds the down-weighting logic described in AI Business Insights, feature 24). The **monitoring dashboard** half — an aggregate metrics computation (`AiMonitoringService.getMonitoring`) that would show success/fallback/failure rates, accuracy/usefulness rates, and a per-module breakdown — is fully written and unit-tested but has **no API controller route exposing it, and no frontend page**. It is not reachable by any user today.

## What User Can Do
- Submit a rating (1–5), "useful" and "accurate" flags, and a comment on any AI recommendation or action, from wherever that recommendation is shown (e.g. AI Insights, AI Predictions)
- View the list of feedback previously submitted, via the underlying API (`GET /ai-feedback`) — there is no dedicated frontend page for browsing this list, but it is not blocked at the API layer the way the monitoring dashboard is

## Workflow
```
Admin sees an AI recommendation/action in AI Insights or AI Predictions
        ↓
Admin clicks thumbs up/down or opens the feedback control
        ↓
Rating + useful/accurate flags + optional comment are submitted
        ↓
Feedback is stored and linked to the underlying AI generation
        ↓
(Not reachable today) Aggregate quality metrics could be computed from
this feedback plus every logged AI generation, but no screen exists to view them
```

## Business Value
- The feedback loop that *is* live directly improves recommendation relevance over time (see AI Business Insights).
- The unbuilt monitoring dashboard, once exposed, would let an admin see at a glance how much of the "AI" output the platform is generating is genuinely AI vs. fallback — valuable for both trust and cost management, but not available yet.

## Technical Summary
- **Purpose:** collect quality feedback on AI output, and (intended) surface aggregate AI-quality metrics.
- **Input:** a rating, useful/accurate booleans, and optional free-text comment tied to an `AiGeneration`, a recommendation ID, or a `RecommendationAction`.
- **Processing:** this module does not call Gemini at all — it is pure data storage and aggregation. `createFeedback`/`findFeedback` are fully wired to the `/ai-feedback` API and are used elsewhere (e.g. `getFeedbackSummaryForPrompt` feeds both the AI Insights recommendation prompt and the down-weighting logic). `getMonitoring` computes total generations, success/failure/fallback counts, accuracy/usefulness rates, action approval/execution rates, and a per-source-module breakdown — but **no controller method or route calls it**, confirmed by searching the entire backend for its only reference (its own definition).
- **Output:** stored `AiFeedback` rows (live); an `AiMonitoringMetrics` object (built, unreachable).
- **Fallback behavior:** not applicable — this is not an AI-calling feature.
- **Known limitations:** the monitoring dashboard has no API route (`AiMonitoringController`/controller method does not exist) and no frontend page; it can currently only be exercised via its unit tests, not by a real user or admin.
- **Modules:** `ai-monitoring` (`AiMonitoringService`, `AiFeedbackController`)
- **Database tables:** `AiFeedback`, `AiGeneration`, `RecommendationAction`
- **Frontend:** no dedicated feedback-browsing or monitoring-dashboard page exists; the thumbs-up/down feedback *control* is embedded inline on AI Insights and AI Predictions pages (`AiFeedbackControl` component), which calls the working `POST /ai-feedback` endpoint.

## Key Capabilities
- Working feedback submission (rating, useful/accurate, comment) tied to any AI generation, recommendation, or action
- Feedback-driven recommendation down-weighting (consumed by AI Insights)
- Built (but unexposed) aggregate AI-quality metrics computation

## Current Status
**Partially Implemented.** Feedback collection is real and actively used elsewhere in the product. The aggregate monitoring dashboard is backend-complete and unit-tested but has **no API route and no frontend page** — it cannot be viewed by anyone today.

**[Insert Screenshot Here]**

---

# 28. AI Predictions

## Purpose
Surfaces forward-looking operational risk — staffing shortages, incident escalation, client churn, payment delay, and contract non-renewal — before they happen, so an admin can act early.

## Overview
Despite the "AI" name and module location, this feature makes **no call to Gemini or any other LLM anywhere in its logic**. Every prediction (staffing risk, incident risk, churn risk, payment risk, renewal risk) is a deterministic weighted formula computed from real shift, incident, invoice, and contract data (e.g. staffing risk = a weighted sum of open guard slots, guard availability conflicts, historical coverage gap rate, and missed-attendance rate). Each prediction includes a risk score, a risk level (high/medium/low), a "confidence score," and a plain-English explanation — all generated by code, not by an AI model. The system's own internal logging is fully honest about this: every prediction dashboard generation is explicitly recorded with `source: 'rule_based'` and, when logged to the shared AI monitoring table, is stamped `fallbackUsed: true` / `status: 'fallback'` — meaning the platform's own audit trail correctly flags this feature as never having attempted a real AI call, even though it lives under an "AI Predictions" banner.

## What User Can Do
- View predicted staffing shortage risk per site (and a weekend-night risk pattern)
- View predicted incident escalation risk per site and by incident type trend
- View predicted client churn risk
- View predicted invoice payment-delay risk per client
- View predicted contract renewal/non-renewal risk
- Rate any prediction's usefulness/accuracy (feeds the same feedback loop as AI Insights)
- See predictions automatically converted into pending AI Actions (see feature 29)

## Workflow
```
Admin opens AI Predictions
        ↓
System pulls upcoming shifts, historical shifts, incidents, invoices,
rate cards, and existing rule-based insight/revenue/scheduling data
        ↓
Five deterministic scoring formulas compute risk scores and confidence
scores for staffing, incidents, churn, payment delay, and renewals
        ↓
Top actionable predictions are converted into recommendations
        ↓
Recommendations are automatically synced into pending AI Actions
        ↓
Dashboard displays predictions, explanations, and supporting data
```

## Business Value
- Gives ops and finance leaders an early-warning system instead of discovering a staffing gap or churn risk after the fact.
- Because the logic is fully deterministic and explainable (every score shows exactly which factors contributed), predictions are auditable and consistent — there is no LLM variability to account for.
- Directly feeds the AI Actions workflow, so a predicted risk can, in principle, become a tracked follow-up task.

## Technical Summary
- **Purpose:** predict staffing, incident, churn, payment, and renewal risk.
- **Input:** upcoming/historical shifts, guard availability, incidents (current vs. previous 30-day windows), invoices, rate cards, and pre-computed outputs from AI Insights, Revenue Intelligence, and the scheduling recommendation service.
- **Processing:** **100% rule-based.** Each prediction category uses a hand-written weighted formula (e.g. incident risk = `existing risk score × 0.65 + trend lift × 20 + high-severity rate × 25`). **No `AiService` method is called anywhere in `PredictionEngineService`.** The dashboard's own generation log entry hardcodes `fallbackUsed: true` and `status: 'fallback'`.
- **Output:** five `PredictionSection`s (staffing/incidents/churn/payments/renewals), each with a risk score, risk level, confidence score, explanation string, supporting data points, and recommendations.
- **Prompt-generation approach:** not applicable — no prompt is ever constructed or sent.
- **Fallback behavior:** not applicable in the usual sense — there is nothing to fall back *from*; the "fallback" stamp in the audit trail is simply an honest label meaning "no AI was used to produce this."
- **Data flow:** predictions are logged to `AiGeneration`; the resulting recommendations are pushed into `AiActionsService.syncFromRecommendations`, creating `RecommendationAction` rows automatically.
- **Known limitations:** despite the feature name, this is entirely deterministic scoring, not machine-learned or LLM-generated prediction; confidence scores are themselves a formula based on sample size and signal count, not a statistical confidence interval; small tenants with little history will see mostly "no elevated risk" placeholder predictions.
- **Modules:** `ai-predictions` (`PredictionEngineService`), reuses `ai-insights`, `ai-monitoring`, `ai-actions`
- **Database tables:** reads `Shift`, `Assignment`, `Availability`, `Incident`, `Invoice`, `RateCard`; writes `AiGeneration`, `RecommendationAction`
- **Frontend:** `/ai-predictions` page, with an inline thumbs-up/down feedback control per prediction/recommendation.

## Key Capabilities
- Staffing shortage risk prediction (site-level and weekend-night pattern)
- Incident escalation risk prediction (site-level and incident-type trend)
- Client churn risk prediction
- Invoice payment-delay risk prediction
- Contract renewal/non-renewal risk prediction
- Automatic conversion of top predictions into pending AI Actions

## Current Status
**Fully Implemented as a rule-based system.** It is real, useful, explainable operational-risk scoring — but it is **not** LLM-generated despite the "AI" branding, and the platform's own internal logging correctly self-reports every generation from this feature as a non-AI fallback.

**[Insert Screenshot Here]**

---

# 29. AI Actions (Recommendation Workflow)

## Purpose
Intended to let an admin turn any AI or rule-based recommendation (from AI Insights, AI Predictions, or scheduling) into a tracked, approvable, executable follow-up task — with a full approve/reject/execute lifecycle.

## Overview
The backend workflow is fully built: recommendations from AI Predictions (and, in principle, other recommendation sources) are automatically synced into `RecommendationAction` records in a `pending` state; an admin action can approve a pending action (which also writes a Knowledge Base entry so the outcome becomes searchable organizational memory), reject it, or execute an approved one (which creates a plain internal `Activity`/task record — execution is explicitly documented in the code as **non-destructive**: it never touches guard assignments, invoices, proposals, or any other business record automatically). **However, there is no controller file for this module at all** — confirmed by searching the entire backend codebase for every reference to `AiActionsService`: it is only used internally by `AiPredictionsService` (to auto-create pending actions) and by its own module/tests. No HTTP route exists to list, approve, reject, or execute an action, and the corresponding frontend route folder (`frontend/src/app/ai-actions`) is empty.
As a result, `RecommendationAction` rows **are** being created automatically today (every time the AI Predictions dashboard loads), but no user — through the UI or the API — can currently approve, reject, or execute any of them.

## What User Can Do
- **Nothing, today.** Recommendation actions are created automatically in the background, but there is no page and no API route for an admin to view, approve, reject, or execute them.

## Workflow
```
AI Predictions dashboard generates recommendations
        ↓
Recommendations are automatically synced into RecommendationAction
records with status "pending"
        ↓
(Intended, not reachable) Admin reviews pending actions
        ↓
(Intended, not reachable) Admin approves → writes a Knowledge Base entry
        ↓
(Intended, not reachable) Admin executes → creates a non-destructive
internal follow-up Activity
```

## Business Value
- **If exposed**, this would close the loop from "AI noticed a risk" to "someone is accountably following up on it," with a full audit trail.
- Today, its only realized value is that pending action records quietly accumulate in the database as a raw list of AI-flagged follow-ups, without any workflow around them.

## Technical Summary
- **Purpose:** approve/reject/execute AI-generated recommendations as tracked follow-up actions.
- **Input:** an `ActionableRecommendation` (from AI Predictions today) with a category, action text, reason, and optional target entity.
- **Processing:** no AI call of any kind — pure business logic (status transitions, entity-existence checks, activity creation). `syncFromRecommendations` runs automatically from `PredictionEngineService`; `approve`/`reject`/`execute` exist and are unit-tested (`ai-actions.service.spec.ts`) but are **not reachable via any HTTP route**.
- **Output:** `RecommendationAction` rows with status `pending` → `approved`/`rejected` → `executed`/`failed`; on approval, a `KnowledgeEntry` is also created; on execution, an `Activity` record is created.
- **Fallback behavior:** not applicable (no AI call).
- **Known limitations:** **no controller exists for this module** — verified by grepping the entire backend for `AiActionsService`/`ai-actions` references, which returns only the module's own files plus its one caller (`ai-predictions`). The frontend `ai-actions` route directory exists but is empty (no `page.tsx`). This means the feature is backend-complete and tested but entirely unusable by an end user today.
- **Modules:** `ai-actions` (`AiActionsService`) — registered in `app.module.ts` but exposes no controller
- **Database tables:** `RecommendationAction`, `KnowledgeEntry` (on approval), `Activity` (on execution)
- **Frontend:** none — `frontend/src/app/ai-actions` is an empty route folder with no page file, and there is no sidebar entry.

## Key Capabilities
- Automatic creation of pending actions from AI Predictions recommendations
- Approve/reject/execute status lifecycle (service-layer only)
- Non-destructive execution (creates a follow-up Activity only)
- Knowledge Base entry creation on approval (service-layer only)

## Current Status
**Partially Implemented.** The workflow logic is real, tested, and does run automatically to create pending records — but with **no API controller and no frontend**, there is currently no way for any user to act on those records. This should be treated as backend scaffolding, not a usable feature.

**[Insert Screenshot Here]**

---

# 30. Knowledge Base & Retrieval

## Purpose
Builds a searchable body of organizational memory — lessons from resolved incidents, closed billing disputes, published daily reports, and approved AI actions — and feeds relevant entries back into other AI features as grounding context.

## Overview
Knowledge entries are created two ways: manually by an admin, or automatically whenever certain business events resolve (an incident is approved, a billing dispute is resolved, a daily report is published, an AI action is approved). Other AI features (AI Insights, AI Copilot, AI Predictions, scheduling recommendations) query this knowledge base for entries relevant to their current context and pass a short digest of them into their Gemini prompts as extra "organizational memory," so recommendations and answers can reflect the tenant's own history, not just current-moment data.

## What User Can Do
- Browse and search knowledge entries by keyword, category, or tag
- Manually create, edit, and archive knowledge entries
- View entries auto-created from resolved incidents, disputes, published reports, and approved AI actions

## Workflow
```
A business event resolves (incident approved / dispute resolved /
report published / AI action approved)
        ↓
System automatically creates a Knowledge Entry summarizing it
        ↓
(Or) Admin manually creates a Knowledge Entry
        ↓
Another AI feature (Copilot, Insights, Predictions, Scheduling) runs a
retrieval query, matching entries by keyword/tag/category overlap
        ↓
Matching entries are formatted and injected into that feature's Gemini
prompt as extra context, and the retrieval itself is audit-logged
```

## Business Value
- Prevents the same operational lessons from being "forgotten" between incidents, disputes, or sales cycles.
- Makes AI-generated recommendations and answers more tenant-specific over time, since they can reference the company's own resolved history.

## Technical Summary
- **Purpose:** store and retrieve organizational knowledge to ground other AI features.
- **Input:** manual entries (title/category/summary/detailed content/keywords/tags), or auto-extracted summaries from resolved incidents, disputes, reports, and approved AI actions.
- **Processing:** this module does **not** call Gemini itself. Retrieval (`findRelevantEntries`) is **keyword/lexical search, not vector or embedding-based semantic search** — confirmed by inspecting the implementation directly: query text is tokenized into keywords (with a small stop-word list), then matched against entries via Prisma `contains` (title/summary/detailed content) and array-membership (`has`) filters on keywords/tags, with a hand-written relevance score (+5 title match, +4 keyword/tag match, +3 summary match, +1 body match). There is no embedding model, vector column, or vector database anywhere in this module.
- **Output:** a ranked list of matching `KnowledgeEntry` records, formatted as short text blocks for injection into a downstream Gemini prompt as "organizational memory."
- **Prompt-generation approach:** not applicable to this module directly — it supplies context *into* other features' prompts, it does not construct a prompt of its own.
- **Fallback behavior:** if no entries match, retrieval simply returns an empty list, and downstream features fall back to their normal (non-memory-augmented) prompt/logic — this never blocks another feature from working.
- **Known limitations:** search quality is bounded by keyword overlap, not semantic understanding — a query and a relevant entry that use different wording for the same concept may not match; there is no embedding-based similarity search despite this being a common expectation for an "AI knowledge base."
- **Modules:** `knowledge-base` (`KnowledgeBaseService`, `KnowledgeRetrievalService`)
- **Database tables:** `KnowledgeEntry`
- **Frontend:** Settings → Knowledge Base page (`/settings/knowledge-base`) for browsing, searching, and manual entry management.

## Key Capabilities
- Manual knowledge entry CRUD with categories and tags
- Automatic entry creation from resolved incidents, disputes, reports, and approved AI actions
- Keyword-based relevance search and retrieval
- Cross-feature "organizational memory" injection into AI Insights, AI Copilot, AI Predictions, and scheduling recommendation prompts
- Full audit logging of every retrieval and manual action

## Current Status
**Fully Implemented as a keyword-search knowledge base.** It works end-to-end and is genuinely used by multiple other AI features — but it should be described to stakeholders as **keyword-based retrieval**, not vector/embedding-based semantic search, since no such capability exists in the code.

**[Insert Screenshot Here]**

---

# 31. Call Transcription

## Purpose
Converts an uploaded sales call recording into text, so it can be fed into AI Discovery Call Intelligence and Live Coaching (feature 22) without a rep having to type notes manually.

## Overview
This is the one AI-labeled feature in the platform that uses **OpenAI's transcription API (Whisper-family model, `gpt-4o-mini-transcribe`), not Google Gemini** — a genuinely separate provider integration dedicated purely to speech-to-text. A rep uploads an audio (or video) file of a sales call; the backend forwards it to OpenAI and returns the plain-text transcript, which can then be pasted straight into the discovery call analysis or live coaching tools.

## What User Can Do
- Check whether transcription is configured (and see supported file types/size limit)
- Upload a call recording (mp3, mp4, wav, webm, ogg, flac, or video containers up to 25MB by default)
- Receive a plain-text transcript to review, edit, and feed into call intelligence/live coaching

## Workflow
```
Rep uploads a call recording on the Sales Calls page
        ↓
File is validated (type, size) and forwarded to OpenAI's transcription API
        ↓
OpenAI returns a plain-text transcript
        ↓
Transcript is shown to the rep, who can edit it before analysis
        ↓
Rep runs "Analyze Call" or "Live Coach" on the resulting text (feature 22)
```

## Business Value
- Removes the manual note-taking burden after a sales call, and captures a more complete, verbatim record than typed summaries.
- Feeds directly into the AI discovery-analysis pipeline, so a recorded call becomes structured, searchable sales intelligence with no extra data entry.

## Technical Summary
- **Purpose:** transcribe an uploaded audio/video sales call recording into text.
- **Input:** an uploaded audio or video file (validated MIME type and extension; 25MB default limit, configurable via `TRANSCRIPTION_MAX_FILE_MB`).
- **Processing:** a **real external API call** to OpenAI's audio transcription endpoint (model configurable via `OPENAI_TRANSCRIPTION_MODEL`, default `gpt-4o-mini-transcribe`) — this is genuinely a different AI provider from the rest of the platform's Gemini-based features.
- **Output:** the transcript text, plus metadata (provider, model, filename, size, elapsed time).
- **Prompt-generation approach:** not applicable — this is a transcription API call, not a text-generation prompt.
- **Fallback behavior:** **there is no fallback.** If `OPENAI_API_KEY` is not configured, unsupported file type, or file too large, the request fails immediately with a clear `400 Bad Request` and message — unlike the Gemini-backed features in this document, it never silently substitutes canned or rule-based text pretending to be a transcript.
- **Known limitations:** requires a separately-configured OpenAI API key (distinct from the platform's Gemini key); no retry/queueing for large files or slow transcription; transcription accuracy is entirely dependent on OpenAI's model, not something this platform controls.
- **Modules:** `call-transcription` (`CallTranscriptionService`)
- **Database tables:** none — transcription is stateless; the resulting text is only persisted if the rep subsequently saves it into a `DiscoverySession` or pastes it into call intelligence/live coach.
- **Frontend:** embedded in the `/sales-calls` page (upload control feeding directly into the discovery call analysis and live coach panels).

## Key Capabilities
- Audio/video call recording upload and transcription
- Configuration status check (so the UI can show whether transcription is available)
- Multiple audio/video format support
- Direct hand-off of transcript text into AI Discovery Call Intelligence and Live Coach

## Current Status
**Fully Implemented.** A real, working third-party (OpenAI) integration with no fake fallback behavior — it either genuinely transcribes the audio or clearly reports that it cannot.

**[Insert Screenshot Here]**

---

# AI Command Center / AI Executive Center — Not Implemented

These two names appear as route placeholders in the codebase but carry **no functionality whatsoever**, in any layer:

- **Backend:** `backend/src/ai-command-center` and `backend/src/ai-executive-center` exist as directories but contain **zero files** — no controller, no service, no module, nothing registered in `app.module.ts`.
- **Frontend:** `frontend/src/app/ai-command-center` and `frontend/src/app/ai-executive-center` exist as route folders but likewise contain **zero files** — no `page.tsx`, nothing rendered at those URLs.
- **Navigation:** neither name appears anywhere in the sidebar (`frontend/src/components/Sidebar.tsx`) or any other navigation surface.
- **Cross-reference:** a full-codebase search for `AiCommandCenter`, `AiExecutiveCenter`, `command-center`, and `executive-center` returns no matches outside these two empty directory names.

This should be represented to stakeholders as **not implemented in any layer** — not a work-in-progress, not a hidden/disabled feature, simply two empty folders left over from earlier scaffolding.

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
