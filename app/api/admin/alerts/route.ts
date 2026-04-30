import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET  /api/admin/alerts         → list all unpublished liquidity alerts for review
// POST /api/admin/alerts         → publish a specific alert by id
// DELETE /api/admin/alerts?id=   → dismiss/delete an alert

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("liquidity_alerts")
    .select("*, funder_profiles(foundation_name, geographic_focus, primary_program_areas)")
    .eq("published", false)
    .eq("hidden_liquidity", true)
    .order("days_remaining", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Alert id required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("liquidity_alerts")
    .update({ published: true })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ published: true });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Alert id required" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase.from("liquidity_alerts").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
