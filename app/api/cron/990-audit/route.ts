import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const PROPUBLICA_BASE = "https://projects.propublica.org/nonprofits/api/v2";
const UNDERSPEND_THRESHOLD = 50_000;
const DAYS_THRESHOLD = 120;

// ── ProPublica helpers ────────────────────────────────────────────────────────

async function fetchOrg(ein: string): Promise<Record<string, unknown> | null> {
  const clean = ein.replace(/-/g, "");
  try {
    const res = await fetch(`${PROPUBLICA_BASE}/organizations/${clean}.json`, {
      headers: { "User-Agent": "Propello/1.0 grant-intelligence-platform" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function mostRecentFiling(data: Record<string, unknown>): Record<string, unknown> | null {
  const filings = (data.filings_with_data as Record<string, unknown>[]) ?? [];
  if (!filings.length) return null;
  return filings.reduce((best, f) =>
    ((f.tax_prd as number) ?? 0) > ((best.tax_prd as number) ?? 0) ? f : best
  );
}

function fiscalYearEndDate(taxPrd: number | null): string | null {
  if (!taxPrd) return null;
  try {
    const s = String(Math.floor(taxPrd));
    const year = parseInt(s.slice(0, 4), 10);
    const month = parseInt(s.slice(4, 6), 10);
    // Last day of that month
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.floor(diff / 86_400_000);
}

function recommendedAction(funderName: string, gap: number, days: number): string {
  const gapFmt = `$${gap.toLocaleString()}`;
  if (days <= 30)
    return `Submit LOI to ${funderName} immediately — only ${days} days remain before their fiscal year ends. They must deploy ${gapFmt} in qualifying distributions.`;
  if (days <= 60)
    return `Contact ${funderName} this week. They carry ${gapFmt} in unspent distributions with ${days} days left in their fiscal year.`;
  return `Flag ${funderName} for near-term outreach. Tracking ${gapFmt} below required 5% distribution with ${days} days remaining.`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  const { data: funders } = await supabase
    .from("funder_profiles")
    .select("*")
    .not("ein", "is", null);

  if (!funders?.length) {
    return NextResponse.json({ audited: 0, alerts_created: 0 });
  }

  let audited = 0;
  let alertsCreated = 0;
  const now = new Date().toISOString();

  for (const funder of funders) {
    if (!funder.ein) continue;

    const data = await fetchOrg(funder.ein);
    if (!data) continue;

    const filing = mostRecentFiling(data);
    if (!filing) continue;

    const totalAssets = Number(filing.totassetsend ?? 0);
    const totalDistributions = Number(filing.totfuncexpns ?? 0);
    const requiredDistribution = Math.floor(totalAssets * 0.05);
    const underspendGap = requiredDistribution - totalDistributions;
    const taxPrd = (filing.tax_prd as number) ?? null;
    const fye = fiscalYearEndDate(taxPrd);
    const lastYear = taxPrd ? parseInt(String(Math.floor(taxPrd)).slice(0, 4), 10) : null;

    // Update funder_profiles with fresh 990 data
    await supabase.from("funder_profiles").update({
      total_assets: totalAssets,
      total_distributions: totalDistributions,
      fiscal_year_end: fye,
      required_distribution: requiredDistribution,
      underspend_gap: Math.max(0, underspendGap),
      last_990_year: lastYear,
      updated_at: now,
    }).eq("id", funder.id);

    audited++;

    // Hidden liquidity check
    const days = daysUntil(fye);
    const isHiddenLiquidity =
      underspendGap > UNDERSPEND_THRESHOLD &&
      days !== null &&
      days > 0 &&
      days <= DAYS_THRESHOLD;

    if (isHiddenLiquidity) {
      const action = recommendedAction(funder.foundation_name, underspendGap, days!);
      await supabase.from("liquidity_alerts").upsert(
        {
          funder_id: funder.id,
          funder_name: funder.foundation_name,
          gap_amount: underspendGap,
          fiscal_year_end: fye,
          days_remaining: days,
          hidden_liquidity: true,
          recommended_action: action,
          published: false,
        },
        { onConflict: "funder_id" }
      );
      alertsCreated++;
    }

    // Rate-limit: 2 req/s is polite for ProPublica's free API
    await new Promise((r) => setTimeout(r, 500));
  }

  return NextResponse.json({ audited, alerts_created: alertsCreated });
}
