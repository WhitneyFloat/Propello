import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const SIMILARITY_THRESHOLD = 0.60;
const HF_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
const HF_API = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch(HF_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
  });
  if (!res.ok) throw new Error(`HF API error: ${res.status} ${await res.text()}`);
  return res.json();
}

function geoMatch(grantGeo: string | null, profileGeo: string | null): boolean {
  const g = (grantGeo ?? "").toLowerCase().trim();
  const p = (profileGeo ?? "").toLowerCase().trim();
  if (!g || g === "national") return true;
  return g.includes(p) || p.includes(g);
}

function budgetEligible(grantMax: number | null, budgetTierMinimum: number | null): boolean {
  if (!grantMax || !budgetTierMinimum) return true;
  return grantMax >= budgetTierMinimum * 0.05;
}

export async function POST(req: NextRequest) {
  // Validate Vercel Cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Pull new grants and all profiles in parallel
  const [grantsRes, profilesRes] = await Promise.all([
    supabase.from("grants_raw").select("*").gte("created_at", since),
    supabase.from("subscriber_profiles").select("*"),
  ]);

  const grants = grantsRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  if (grants.length === 0 || profiles.length === 0) {
    return NextResponse.json({ grants_processed: grants.length, profiles_checked: profiles.length, matches_written: 0 });
  }

  // Get embeddings — batch all texts in two calls
  const grantTexts = grants.map((g) => g.description || g.grant_title || "");
  const profileTexts = profiles.map((p) => p.mission_statement || "");

  const [grantEmbeddings, profileEmbeddings] = await Promise.all([
    getEmbeddings(grantTexts),
    getEmbeddings(profileTexts),
  ]);

  const now = new Date().toISOString();
  const matches: object[] = [];

  for (let i = 0; i < grants.length; i++) {
    for (let j = 0; j < profiles.length; j++) {
      if (!geoMatch(grants[i].geo, profiles[j].primary_geo)) continue;
      if (!budgetEligible(grants[i].award_max, profiles[j].budget_tier_minimum)) continue;

      const similarity = cosineSimilarity(grantEmbeddings[i], profileEmbeddings[j]);
      if (similarity < SIMILARITY_THRESHOLD) continue;

      matches.push({
        subscriber_id: profiles[j].id,
        grant_id: grants[i].id,
        raw_similarity_score: Math.round(similarity * 10000) / 10000,
        scored_at: now,
      });
    }
  }

  if (matches.length > 0) {
    await supabase.from("grant_matches").insert(matches);
  }

  return NextResponse.json({
    grants_processed: grants.length,
    profiles_checked: profiles.length,
    matches_written: matches.length,
  });
}
