"use client";

const STATS = [
  { label: "Grants Tracked", value: "12,400+" },
  { label: "Funders Profiled", value: "3,200+" },
  { label: "Hidden Liquidity Alerts", value: "Weekly" },
  { label: "Avg Fit Score Accuracy", value: "91%" },
];

export default function GrantTicker() {
  return (
    <section className="bg-charcoal border-y border-teal/20 py-8">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 px-6">
        {STATS.map((stat) => (
          <div key={stat.label} className="text-center">
            <div className="text-3xl font-bold text-teal">{stat.value}</div>
            <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
