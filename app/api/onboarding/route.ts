import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

const BUDGET_TIER_MINIMUMS: Record<string, number> = {
  "<$100K": 0,
  "$100K-$500K": 100000,
  "$500K-$1M": 500000,
  "$1M-$5M": 1000000,
  "$5M+": 5000000,
};

function classifyTier(annual_budget: string): string {
  // Subscribers start on free tier — upgraded via Stripe
  return "free";
}

function generateProfileId(org_name: string): string {
  const slug = org_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slug}-${suffix}`;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { org_name, mission_statement, ntee_code, primary_geo, program_types, annual_budget, staff_count } = body;

  // Validate required fields
  if (!org_name?.trim()) return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
  if (!mission_statement?.trim() || mission_statement.trim().length < 20) return NextResponse.json({ error: "Mission statement must be at least 20 characters" }, { status: 400 });
  if (!ntee_code) return NextResponse.json({ error: "NTEE category is required" }, { status: 400 });
  if (!primary_geo?.trim()) return NextResponse.json({ error: "Primary geography is required" }, { status: 400 });
  if (!Array.isArray(program_types) || program_types.length === 0) return NextResponse.json({ error: "Select at least one program type" }, { status: 400 });
  if (!annual_budget || !(annual_budget in BUDGET_TIER_MINIMUMS)) return NextResponse.json({ error: "Annual budget selection is required" }, { status: 400 });
  if (!staff_count) return NextResponse.json({ error: "Staff count is required" }, { status: 400 });

  const profile_id = generateProfileId(org_name);
  const tier = classifyTier(annual_budget);
  const budget_tier_minimum = BUDGET_TIER_MINIMUMS[annual_budget];

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("subscriber_profiles").insert({
    org_name: org_name.trim(),
    mission_statement: mission_statement.trim(),
    ntee_code,
    primary_geo: primary_geo.trim(),
    program_types,
    annual_budget,
    budget_tier_minimum,
    staff_count: parseInt(staff_count, 10),
    profile_id,
    tier,
  });

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ profile_id, tier });
}
