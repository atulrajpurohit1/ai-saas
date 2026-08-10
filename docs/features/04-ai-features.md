[← Back to main documentation](../FEATURE_DOCUMENTATION.md)

# AI Features

This domain covers every feature in the platform that carries an "AI" label. Because clients need to know exactly what they are paying for, **each feature below states plainly whether it makes a real call to Google Gemini (or, for transcription, OpenAI Whisper), whether it is deterministic rule-based logic, or a blend of both** — and what happens when the AI provider is slow, misconfigured, or unavailable.

**Shared architecture note:** every AI-flavored feature in this document is built on one shared backend service, `AiService` (`backend/src/ai/ai.service.ts`), which wraps a single Google Gemini client (`@google/generative-ai`, model configurable via `GEMINI_MODEL`). A feature only gets real LLM output if `GEMINI_API_KEY` is set and the Gemini call succeeds. Nearly every generation method has a matching private, deterministic `fallback*()` template that is used automatically when Gemini is unavailable or fails (gated by the `ENABLE_AI_FALLBACK` environment variable for some methods, silent/automatic for others) — every AI feature in this document degrades gracefully rather than hard-failing when Gemini is down, unless stated otherwise.

> **Major change since the last documentation pass (2026-08-07):** a broad backend cleanup ("api issue try to resolve") **entirely deleted** the AI Copilot, AI Actions, and AI Predictions modules, and removed the AI Governance module's admin-facing controllers (prompt versioning UI, AI audit log UI) along with the AI Insights and AI Revenue Intelligence *dashboard* consumers of `AiService`. The corresponding frontend pages (`/ai-copilot`, `/ai-insights`, `/ai-insights/incidents`, `/ai-insights/revenue`, `/ai-predictions`, `/ai-prompts`, `/ai-audit`) were removed in the same change. The **Knowledge Base** module (which many of those features read from for grounding context) was removed in an earlier commit (2026-07-15) along with **SSO** — see `docs/features/01-authentication-security.md`. None of these six features are described below, since none of them exist in the current codebase in any user-reachable form. What remains active is documented in full below: proposal drafting, sales assessment/discovery/outreach coaching, guard-shift recommendations, AI feedback collection, and call transcription — plus AI-assisted RFP drafting and evaluation, which is a newly added capability documented in `docs/features/08-rfp-vendor-management.md` rather than repeated here.

---

# 16. AI Proposal Drafting

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
- **Input:** lead name, company, status, up to a handful of related notes, and related deal names (`ProposalsService.generateForLead`); a second, simpler entry point (`AiController` → `POST /ai/proposal-draft`) accepts a manually-typed site name, guard count, requirements, and notes. This is the only route left on `AiController` — every other AI capability is invoked through its own feature module's controller (sales-accelerator, prospect-search, rfp).
- **Processing:** a real Gemini call is made (`AiService.generateForLead` / `generateProposalDraft`) using a fixed, hardcoded prompt template.
- **Output:** a Markdown-formatted proposal document saved as `Proposal.content`.
- **Fallback behavior:** if Gemini is unavailable/fails and `ENABLE_AI_FALLBACK=true`, a short canned template proposal is returned instead; if the flag is off, the request fails with a 500 error rather than silently returning fake AI content.
- **Modules:** `proposals`, `ai` (shared `AiService`)
- **Database tables:** `Proposal`, `ProposalVersion`, `ProposalComment`
- **Frontend:** `/proposals` list/detail pages with "Generate", "Generate Bulk", edit, export-PDF, and share actions; embedded generation is also available from a lead's detail view.

## Key Capabilities
- Single-lead and bulk AI proposal generation
- Automatic version history on every content edit
- Branded PDF export
- Client-portal sharing with comment thread

## Current Status
**Fully Implemented.** A real, working Gemini integration end to end (UI → API → service → Gemini → database), with a defined (if basic) fallback path when Gemini is unavailable.

**[Insert Screenshot Here]**

---

# 17. AI Sales Assessment & Lead Scoring

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
- **Processing:** a real Gemini call is made (`AiService.generateSalesAssessment`) with a fixed prompt requesting `leadScore`, `priorityTier`, `closeReadinessScore`, `discoveryQualityScore`, `riskProfile`, `proposalAngle`, `recommendedNextAction`, `missingQuestions`, `objectionRisks`, and `summary` as JSON. A rule-based heuristic (`ruleAssessment`) is computed independently every time and used to fill in any field Gemini omits or fails to return, and as the entire result if the Gemini call throws.
- **Output:** a `SalesAssessment` record with numeric scores, tier, and narrative text fields.
- **Fallback behavior:** silent rule-based fallback — the user is never blocked or shown an error; the record is stamped `fallbackUsed: true` internally when Gemini did not produce the result.
- **Data flow / logging:** every attempt is logged to `AiGeneration` via `AiMonitoringService.logGeneration` with `sourceModule: 'sales_accelerator'` and `promptKey: 'sales_assessment'`.
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

# 18. AI Discovery Guide, Outreach & Call Intelligence

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
- **Input:** lead/deal context text plus (for call intelligence/live coach) admin-typed call notes or a transcript (see Call Transcription, feature 22, for how audio becomes that transcript text).
- **Processing:** each of the four sub-features makes a real Gemini call with its own fixed prompt (`AiService.generateDiscoveryGuide`, `generateOutreachPlan`, `generateDiscoveryCallIntelligence`, `generateDiscoveryLiveCoach`). Each has a matching rule-based fallback implemented independently in `SalesAcceleratorService` (`ruleDiscoveryGuide`, `ruleOutreachPlan`, `ruleDiscoveryCallIntelligence`, `ruleDiscoveryLiveCoach`) that pattern-matches keywords in the transcript text when Gemini fails.
- **Output:** structured JSON (arrays of questions/talking points/prompts, scripts, or scored discovery fields), always returned in the same shape whether AI- or rule-generated.
- **Fallback behavior:** silent — on any Gemini error the service logs a warning and substitutes the rule-based result; the caller always gets a usable response.
- **Data flow / logging:** every generation (AI or fallback) is logged to `AiGeneration` with `sourceModule: 'sales_accelerator'` and the relevant `promptKey`.
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

# 19. Guard Shift AI Recommendations

## Purpose
Helps a scheduler quickly pick the right guard for an open shift by ranking candidate guards and explaining, in plain English, why the top picks are a good fit.

## Overview
When a scheduler asks for guard recommendations on a specific shift, the system scores every eligible guard using a deterministic formula (availability, proximity/site history, past attendance reliability, incident history, and other operational signals), then optionally asks Gemini to turn the top-ranked candidates' scores into a short, readable explanation of why each is recommended.

## What User Can Do
- Request ranked guard recommendations for a specific open shift
- See each candidate's score and a natural-language (or rule-based) explanation of the ranking

## Workflow
```
Scheduler opens a shift and requests recommendations
        ↓
System scores every eligible guard using a rule-based formula
(availability, reliability, incident history, and other factors)
        ↓
Top-ranked candidates are optionally sent to Gemini for a short
natural-language explanation of the recommendation
        ↓
Ranked list + explanation is shown to the scheduler
```

## Business Value
- Speeds up shift assignment by surfacing the best-fit guard first instead of scrolling a full roster.
- The rule-based scoring foundation means recommendations are always available and explainable, even without Gemini.

## Technical Summary
- **Purpose:** rank and recommend guards for a specific shift, with a natural-language explanation.
- **Input:** the target shift's requirements plus every eligible guard's availability, site history, attendance record, and incident history.
- **Processing:** scoring itself (`RecommendationService.recommendGuards`) is 100% rule-based — a weighted formula with explicit bonuses/penalties (availability match, proximity, prior site experience, late/missed-shift penalties, incident penalties). A real Gemini call (`AiService.explainGuardRecommendation`) is optionally made afterward purely to phrase the explanation for the top candidates; this call passes through `AiGovernanceService.resolvePromptVersion` internally (see Known Limitations).
- **Output:** a ranked list of guards with numeric scores and an explanation string per candidate.
- **Fallback behavior:** if the Gemini explanation call fails, a deterministic, rule-based explanation string is used instead — the ranking itself is never affected, since it was never AI-generated in the first place.
- **Known limitations:** although `RecommendationService` still resolves a prompt version through `AiGovernanceService`, there is no admin screen left to author or activate a custom prompt version for this capability (see Known Limitations in the main documentation) — it will always resolve to the built-in default prompt.
- **Modules:** `ai-insights` (`RecommendationService`) — this module has no HTTP controller of its own; it is consumed directly by `shifts`.
- **Database tables:** reads `Shift`, `Assignment`, `Availability`, `Guard`, `AttendanceEvent`, `Incident`
- **Frontend:** embedded "Recommend Guards" action on the `/shifts` page.

## Key Capabilities
- Rule-based, explainable guard scoring for a specific shift
- Optional Gemini-generated natural-language explanation of top picks
- Always-available deterministic fallback explanation

## Current Status
**Fully Implemented.** This is the one surviving, user-reachable capability of the former "AI Insights" module — the broader insights dashboard, revenue intelligence, and their own frontend pages were removed on 2026-08-07 (see the domain-level note above); this specific guard-recommendation capability remained wired into the Shifts page throughout.

**[Insert Screenshot Here]**

---

# 20. AI Feedback Collection

## Purpose
Lets an admin record a quality rating on an AI-generated output, so that signal can be used elsewhere to judge whether a specific kind of AI output is trustworthy.

## Overview
A generic feedback endpoint accepts a 1–5 rating, "useful"/"accurate" flags, and an optional comment tied to any logged AI generation. This is a small, self-contained capability: it stores feedback and lets it be queried back, but the recommendation-down-weighting and quality-dashboard features that used to consume this feedback (AI Business Insights, AI Predictions) were removed on 2026-08-07 along with the rest of the AI Insights/Predictions dashboards.

## What User Can Do
- Submit a rating (1–5), "useful" and "accurate" flags, and a comment on any AI generation, via the API — **there is currently no UI control anywhere in the app that calls this endpoint** (see Current Status)
- Retrieve previously submitted feedback via the API (`GET /ai-feedback`)

## Workflow
```
An AI generation happens somewhere in the platform (proposal, RFP
draft, sales assessment, discovery guide, etc.) and is logged
        ↓
(No UI surface exists today to prompt for or submit feedback on it)
```

## Business Value
- As designed, this feedback loop would let admins flag low-quality AI output so the platform (or a future analytics view) could learn from it. With no UI trigger and no remaining downstream consumer, that value is not currently realized.

## Technical Summary
- **Purpose:** collect a quality rating on any logged AI generation.
- **Input:** a rating, useful/accurate booleans, and optional free-text comment tied to an `AiGeneration` ID.
- **Processing:** no AI call — pure data storage. `AiFeedbackController` (`POST /ai-feedback`, `GET /ai-feedback`) is fully wired to `AiMonitoringService.createFeedback`/`findFeedback`.
- **Output:** stored `AiFeedback` rows.
- **Known limitations:** a `AiFeedbackControl` React component exists in `frontend/src/components/AiFeedbackControl.tsx` but is **not imported or rendered by any page** in the current frontend — confirmed by searching for its import across `frontend/src`. The aggregate monitoring-metrics computation (`AiMonitoringService.getMonitoring`) referenced in earlier documentation has also been removed along with the rest of the AI monitoring dashboard.
- **Modules:** `ai-monitoring` (`AiFeedbackController`, `AiMonitoringService`)
- **Database tables:** `AiFeedback`, `AiGeneration`
- **Frontend:** an unused component only (`AiFeedbackControl.tsx`); no page currently renders it.

## Key Capabilities
- Feedback submission API (rating, useful/accurate, comment) tied to any AI generation
- Feedback retrieval API

## Current Status
**Partially Implemented — backend only, no reachable UI.** The API works correctly if called directly, but there is no button, form, or page anywhere in the current frontend that lets an admin actually submit or browse feedback. This should be treated as backend scaffolding today, not a usable feature for an end user.

**[Insert Screenshot Here]**

---

# 21. Call Transcription

## Purpose
Converts an uploaded sales call recording into text, so it can be fed into AI Discovery Call Intelligence and Live Coaching (feature 18) without a rep having to type notes manually.

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
Rep runs "Analyze Call" or "Live Coach" on the resulting text (feature 18)
```

## Business Value
- Removes the manual note-taking burden after a sales call, and captures a more complete, verbatim record than typed summaries.
- Feeds directly into the AI discovery-analysis pipeline, so a recorded call becomes structured, searchable sales intelligence with no extra data entry.

## Technical Summary
- **Purpose:** transcribe an uploaded audio/video sales call recording into text.
- **Input:** an uploaded audio or video file (validated MIME type and extension; 25MB default limit, configurable via `TRANSCRIPTION_MAX_FILE_MB`).
- **Processing:** a real external API call to OpenAI's audio transcription endpoint (model configurable via `OPENAI_TRANSCRIPTION_MODEL`, default `gpt-4o-mini-transcribe`) — this is genuinely a different AI provider from the rest of the platform's Gemini-based features.
- **Output:** the transcript text, plus metadata (provider, model, filename, size, elapsed time).
- **Fallback behavior:** **there is no fallback.** If `OPENAI_API_KEY` is not configured, unsupported file type, or file too large, the request fails immediately with a clear `400 Bad Request` and message — unlike the Gemini-backed features in this document, it never silently substitutes canned or rule-based text pretending to be a transcript.
- **Known limitations:** requires a separately-configured OpenAI API key (distinct from the platform's Gemini key); no retry/queueing for large files or slow transcription.
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

# Removed / Not Implemented AI Features

For completeness, the following AI-adjacent capabilities were described in earlier documentation and are **explicitly no longer present** (or were never present) in the current codebase. They are listed here only so they are not mistakenly assumed to still exist.

| Former feature | Status | What happened |
|---|---|---|
| AI Copilot (natural-language Q&A) | **Removed 2026-08-07** | `ai-copilot` backend module and `/ai-copilot` frontend page fully deleted. The one surviving trace is an orphaned `AiService.generateCopilotAnswer()` method with zero callers anywhere in the codebase. |
| AI Business Insights & Recommendations (dashboard) | **Removed 2026-08-07** | `/ai-insights` and `/ai-insights/incidents` frontend pages deleted; the dashboard-facing parts of `AiInsightsService` were removed along with their controller. Only the unrelated `RecommendationService.recommendGuards` capability (feature 19 above) survived. |
| AI Revenue Intelligence | **Removed 2026-08-07** | `RevenueInsightsService` and `/ai-insights/revenue` frontend page deleted. |
| AI Governance admin UI (prompt versioning, AI audit log) | **Removed 2026-08-07** | `ai-audit.controller.ts` and `ai-prompts.controller.ts` (and their DTOs) deleted from `ai-governance`; `/ai-prompts` and `/ai-audit` frontend pages deleted. `AiGovernanceService` itself still exists and still runs internally (prompt-version resolution, safety screening) for the surviving `ai-insights`/`ai-monitoring` consumers, but there is no admin screen left to author a custom prompt or review the AI audit trail. |
| AI Predictions (staffing/incident/churn/payment/renewal risk) | **Removed 2026-08-07** | `ai-predictions` backend module and `/ai-predictions` frontend page fully deleted. |
| AI Actions (recommendation approve/reject/execute workflow) | **Removed 2026-08-07** | `ai-actions` backend module fully deleted (it never had a frontend page or controller even before removal). |
| Knowledge Base & Retrieval | **Removed 2026-07-15** | `knowledge-base` backend module, `/settings/knowledge-base` frontend page, and the `KnowledgeEntry` Prisma model fully deleted, alongside SSO — see `docs/features/01-authentication-security.md`. |
| AI Command Center / AI Executive Center | **Never implemented** | Empty placeholder directories only, in both backend and frontend, with no sidebar entry — unchanged from earlier documentation. |

---

[← Back to main documentation](../FEATURE_DOCUMENTATION.md)
