import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const HIGH_PRIORITY_THRESHOLD = 85;

const WEIGHTS = {
  mission_alignment:    0.25,
  budget_fit:           0.20,
  geo_match:            0.15,
  deadline_urgency:     0.10,
  funder_history:       0.10,
  program_type_overlap: 0.10,
  competitive_density:  0.05,
  liquidity_signal:     0.05,
} as const;

type Dimension = keyof typeof WEIGHTS;

const DIMENSION_LABELS: Record<Dimension, string> = {
  mission_alignment:    "Mission alignment",
  budget_fit:           "Budget fit",
  geo_match:            "Geographic match",
  deadline_urgency:     "Deadline urgency",
  funder_history:       "Funder grant history",
  program_type_overlap: "Program type overlap",
  competitive_density:  "Competitive density",
  liquidity_signal:     "Funder liquidity signal",
};

// ── Scoring functions (each returns 0–100) ────────────────────────────────────

function scoreMissionAlignment(rawSimilarity: number): number {
  return Math.min(100, Math.round(rawSimilarity * 100));
}

function scoreBudgetFit(awardMin: number | null, awardMax: number | null, budgetTierMinimum: number | null): number {
  if (!awardMax || !budgetTierMinimum) return 50;
  if (awardMax < budgetTierMinimum * 0.05) return 10;
  if (awardMin && awardMin > budgetTierMinimum * 10) return 20;
  if (awardMax >= budgetTierMinimum * 0.10 && (!awardMin || awardMin <= budgetTierMinimum * 5)) return 100;
  return 70;
}

function scoreGeoMatch(grantGeo: string | null, profileGeo: string | null): number {
  const g = (grantGeo ?? "").toLowerCase().trim();
  const p = (profileGeo ?? "").toLowerCase().trim();
  if (!g || g === "national") return 50;
  if (g === p || (g.length > 3 && p.includes(g)) || (p.length > 3 && g.includes(p))) return 100;
  const gParts = new Set(g.replace(/,/g, " ").split(" ").filter(Boolean));
  const pParts = new Set(p.replace(/,/g, " ").split(" ").filter(Boolean));
  if ([...gParts].some((w) => pParts.has(w))) return 70;
  return 30;
}

function scoreDeadlineUrgency(deadline: string | null): number {
  if (!deadline) return 40;
  const days = Math.floor((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 0;
  if (days <= 30) return 100;
  if (days <= 60) return 80;
  if (days <= 90) return 60;
  return 40;
}

function scoreProgramTypeOverlap(grantTypes: string[], profileTypes: string[]): number {
  const g = new Set(grantTypes.map((t) => t.toLowerCase()));
  const p = new Set(profileTypes.map((t) => t.toLowerCase()));
  if (!g.size || !p.size) return 50;
  const overlap = [...g].filter((t) => p.has(t)).length;
  const union = new Set([...g, ...p]).size;
  const jaccard = overlap / union;
  return Math.min(100, Math.round(jaccard * 100 + overlap * 10));
}

function scoreCompetitiveDensity(grantGeo: string | null): number {
  const g = (grantGeo ?? "").toLowerCase();
  if (g.includes("new york city") || g.includes("nyc") || g.includes("manhattan")) return 30;
  if (g.includes("new york")) return 50;
  if (g.includes("national") || !g) return 20;
  return 65;
}

function scoreFunderHistory(funderAreas: string[], profileTypes: string[]): number {
  if (!funderAreas.length || !profileTypes.length) return 50;
  const fa = new Set(funderAreas.map((a) => a.toLowerCase()));
  const pt = new Set(profileTypes.map((t) => t.toLowerCase()));
  const overlap = [...fa].filter((a) => pt.has(a)).length;
  if (overlap >= 2) return 100;
  if (overlap === 1) return 70;
  return 30;
}

// ── Composite score + rationale ───────────────────────────────────────────────

function computeScore(dimensions: Record<Dimension, number>): number {
  const total = (Object.keys(WEIGHTS) as Dimension[]).reduce(
    (sum, dim) => sum + dimensions[dim] * WEIGHTS[dim],
    0
  );
  return Math.min(100, Math.round(total));
}

function generateRationale(
  dimensions: Record<Dimension, number>,
  grant: Record<string, unknown>,
  profile: Record<string, unknown>
): string {
  const ranked = (Object.keys(WEIGHTS) as Dimension[]).sort(
    (a, b) => dimensions[b] * WEIGHTS[b] - dimensions[a] * WEIGHTS[a]
  );
  const top3 = ranked.slice(0, 3);
  const parts = top3.map((dim) => {
    const score = dimensions[dim];
    switch (dim) {
      case "mission_alignment":
        return `${DIMENSION_LABELS[dim]}: ${score}% semantic match to your mission`;
      case "budget_fit": {
        const min = grant.award_min as number | null;
        const max = grant.award_max as number | null;
        const range = max ? `$${(min ?? 0).toLocaleString()}–$${max.toLocaleString()}` : "unspecified award";
        return `${DIMENSION_LABELS[dim]}: ${range} aligns with your budget tier`;
      }
      case "geo_match":
        return `${DIMENSION_LABELS[dim]}: ${(grant.geo as string) || "national"} funding (${score}% match)`;
      case "deadline_urgency": {
        const dl = grant.deadline as string | null;
        if (dl) {
          const days = Math.floor((new Date(dl).getTime() - Date.now()) / 86_400_000);
          return `${DIMENSION_LABELS[dim]}: closes in ${days} days`;
        }
        return `${DIMENSION_LABELS[dim]}: active deadline`;
      }
      case "program_type_overlap":
        return `${DIMENSION_LABELS[dim]}: strong alignment with your program focus`;
      case "funder_history":
        return `${DIMENSION_LABELS[dim]}: ${(grant.foundation_name as string) || "This funder"} has supported similar work`;
      case "liquidity_signal":
        return `${DIMENSION_LABELS[dim]}: funder may have unspent distribution requirement`;
      default:
        return `${DIMENSION_LABELS[dim]}: ${score}/100`;
    }
  });
  return parts.join(". ") + ".";
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  // Pull unscored matches
  const { data: matches } = await supabase
    .from("grant_matches")
    .select("*")
    .is("final_score", null);

  if (!matches || matches.length === 0) {
    return NextResponse.json({ scored: 0, high_priority_flagged: 0 });
  }

  // Cache grants and profiles
  const grantIds = [...new Set(matches.map((m) => m.grant_id))];
  const profileIds = [...new Set(matches.map((m) => m.subscriber_id))];

  const [{ data: grantsArr }, { data: profilesArr }, { data: liquidityAlerts }, { data: funderProfilesArr }] =
    await Promise.all([
      supabase.from("grants_raw").select("*").in("id", grantIds),
      supabase.from("subscriber_profiles").select("*").in("id", profileIds),
      supabase.from("liquidity_alerts").select("funder_name").eq("hidden_liquidity", true),
      supabase.from("funder_profiles").select("foundation_name, primary_program_areas"),
    ]);

  const grants = Object.fromEntries((grantsArr ?? []).map((g) => [g.id, g]));
  const profiles = Object.fromEntries((profilesArr ?? []).map((p) => [p.id, p]));
  const liquidityFunders = new Set((liquidityAlerts ?? []).map((a) => a.funder_name));
  const funderAreas = Object.fromEntries(
    (funderProfilesArr ?? []).map((f) => [f.foundation_name, f.primary_program_areas ?? []])
  );

  let scored = 0;
  let highPriorityFlagged = 0;
  const now = new Date().toISOString();

  for (const match of matches) {
    const grant = grants[match.grant_id];
    const profile = profiles[match.subscriber_id];
    if (!grant || !profile) continue;

    const dimensions: Record<Dimension, number> = {
      mission_alignment:    scoreMissionAlignment(match.raw_similarity_score ?? 0),
      budget_fit:           scoreBudgetFit(grant.award_min, grant.award_max, profile.budget_tier_minimum),
      geo_match:            scoreGeoMatch(grant.geo, profile.primary_geo),
      deadline_urgency:     scoreDeadlineUrgency(grant.deadline),
      funder_history:       scoreFunderHistory(funderAreas[grant.foundation_name] ?? [], profile.program_types ?? []),
      program_type_overlap: scoreProgramTypeOverlap(grant.program_types ?? [], profile.program_types ?? []),
      competitive_density:  scoreCompetitiveDensity(grant.geo),
      liquidity_signal:     liquidityFunders.has(grant.foundation_name) ? 100 : 0,
    };

    const finalScore = computeScore(dimensions);
    const isHighPriority = finalScore >= HIGH_PRIORITY_THRESHOLD;
    const rationale = generateRationale(dimensions, grant, profile);

    const scoreBreakdown = Object.fromEntries(
      (Object.keys(WEIGHTS) as Dimension[]).map((dim) => [
        dim,
        { score: dimensions[dim], weight: WEIGHTS[dim], contribution: Math.round(dimensions[dim] * WEIGHTS[dim] * 100) / 100 },
      ])
    );

    await supabase
      .from("grant_matches")
      .update({ final_score: finalScore, score_breakdown: scoreBreakdown, rationale, high_priority: isHighPriority, scored_at: now })
      .eq("id", match.id);

    scored++;
    if (isHighPriority) highPriorityFlagged++;
  }

  return NextResponse.json({ scored, high_priority_flagged: highPriorityFlagged });
}
