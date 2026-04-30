# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project Context — Propello

**Stack:** Next.js · React · Tailwind CSS · Vercel (frontend) · Supabase (backend) · Clerk (auth) · Stripe (payments) · Beehiiv (newsletter) · Python agents · ProPublica API

**Antigravity is NOT a project dependency.** References to "Antigravity" in source documents are prompts the developer used in an external tool during planning. All agent logic (intake, mission-match, fit scoring, 990 audit) is built as Python scripts inside this repo and scheduled via Vercel Cron or equivalent. Do not assume or introduce any Antigravity dependency.

---

## Build Status

### Completed

| Phase | Milestone | Key files |
|---|---|---|
| 1 — Foundation | Infrastructure live | `next.config.ts` · `tailwind.config.ts` · `middleware.ts` · `supabase/migrations/001_initial_schema.sql` · `lib/supabase.ts` · `lib/stripe.ts` · `.env.example` · `vercel.json` |
| 2 — Agent 1 | Onboarding flow live | `app/onboarding/page.tsx` · `app/api/onboarding/route.ts` · `app/onboarding/success/` · `agents/agent1-intake.py` |
| 3 — Agent 2 | Matching engine operational | `agents/agent2-mission-match.py` · `agents/grant_scraper.py` · `agents/requirements.txt` · `app/api/cron/mission-match/route.ts` |
| 4 — Agent 3 | Fit Scores generating | `agents/agent3-fit-score.py` · `app/api/cron/fit-score/route.ts` · `vercel.json` updated |
| 5 — Agent 4 | 990 audit running | `agents/agent4-990-audit.py` · `app/api/cron/990-audit/route.ts` · `app/api/admin/alerts/route.ts` |

### Daily pipeline (fully wired)
```
5:00AM  grant_scraper.py           → feeds grants_raw
6:00AM  /api/cron/mission-match    → cosine similarity → grant_matches (raw scores)
6:30AM  /api/cron/fit-score        → 8-dimension scoring → final_score + rationale
Sun 2AM /api/cron/990-audit        → ProPublica API → liquidity_alerts (unpublished)
Wed     Admin reviews alerts       → GET/POST /api/admin/alerts
```

### Remaining

| Phase | Milestone | What to build |
|---|---|---|
| 6 — Dashboard | Dashboard MVP live | `GrantFeed` component (cards, Fit Score badges, filters) · Score breakdown side panel (Chart.js) · `LiquidityAlertPanel` · `FunderProfile` pages · Drafting Kit library (Tier 2) |
| 7 — Newsletter | First issue ready | Beehiiv API integration · weekly grant digest auto-assembly · Sector Pulse section |
| 8 — Beta Launch | Beta cohort onboarded | 20 NYC nonprofit EDs invited · feedback loop on Fit Score quality and dashboard UX |
| 9 — Revenue Launch | Revenue live | Stripe subscriptions (Core $99/mo · Growth $299/mo) · Board Brief one-time ($500) · Stripe webhook handler · tier-gating on dashboard features |

### Outstanding env vars (add to `.env.local` before going live)
| Var | Where to get it | Needed for |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | Agent API routes, admin endpoints |
| `HUGGINGFACE_API_KEY` | huggingface.co/settings/tokens (free) | Mission-match cron |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` | All `/api/cron/*` routes |
| `STRIPE_SECRET_KEY` + price IDs | Stripe dashboard | Phase 9 payments |
| `BEEHIIV_API_KEY` + publication ID | Beehiiv dashboard | Phase 7 newsletter |
| `PROPUBLICA_API_KEY` | projects.propublica.org/nonprofits/api | Phase 5 (optional — API works without key at low volume) |
