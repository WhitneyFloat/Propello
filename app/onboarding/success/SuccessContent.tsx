"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  core: "Core",
  growth: "Growth",
  board_brief: "Board Brief",
};

export default function SuccessContent() {
  const params = useSearchParams();
  const profile_id = params.get("profile_id");
  const tier = params.get("tier") ?? "free";

  return (
    <div className="w-full max-w-lg text-center">
      <div className="text-5xl mb-6">
        <span className="inline-block bg-teal/10 border border-teal/30 rounded-full px-6 py-3 text-teal font-bold text-2xl">
          Profile Active
        </span>
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">
        Your grant radar is live.
      </h1>
      <p className="text-gray-400 mb-8">
        Your first mission-matched grants will appear in your dashboard by tomorrow morning.
        Check back Thursday for your weekly newsletter.
      </p>

      <div className="bg-charcoal rounded-xl p-6 border border-teal/20 mb-8 text-left">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-400 text-sm">Profile ID</span>
          <span className="text-teal font-mono text-sm">{profile_id}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Current plan</span>
          <span className="text-white font-semibold">{TIER_LABELS[tier] ?? tier}</span>
        </div>
      </div>

      <Link
        href="/dashboard"
        className="block w-full bg-teal text-white py-3 rounded-lg font-semibold hover:bg-opacity-90 transition text-center"
      >
        Go to my dashboard
      </Link>
    </div>
  );
}
