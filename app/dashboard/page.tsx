import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-navy p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Your Grant Dashboard</h1>
      <p className="text-gray-400 mb-8">
        Your mission-matched grants update every morning at 6AM.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <a href="/dashboard/grants" className="bg-charcoal rounded-xl p-6 border border-teal/20 hover:border-teal/60 transition">
          <div className="text-teal text-2xl font-bold mb-1">Grants</div>
          <div className="text-gray-400 text-sm">Mission-matched feed</div>
        </a>
        <a href="/dashboard/liquidity" className="bg-charcoal rounded-xl p-6 border border-gold/20 hover:border-gold/60 transition">
          <div className="text-gold text-2xl font-bold mb-1">Liquidity</div>
          <div className="text-gray-400 text-sm">Hidden liquidity alerts</div>
        </a>
        <a href="/dashboard/funders" className="bg-charcoal rounded-xl p-6 border border-electric-blue/20 hover:border-electric-blue/60 transition">
          <div className="text-electric-blue text-2xl font-bold mb-1">Funders</div>
          <div className="text-gray-400 text-sm">990-powered profiles</div>
        </a>
        <a href="/dashboard/drafting-kits" className="bg-charcoal rounded-xl p-6 border border-orange/20 hover:border-orange/60 transition">
          <div className="text-orange text-2xl font-bold mb-1">Drafting Kits</div>
          <div className="text-gray-400 text-sm">LOI frameworks</div>
        </a>
      </div>
    </main>
  );
}
