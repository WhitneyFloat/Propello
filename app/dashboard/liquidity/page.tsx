import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function LiquidityPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-navy p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Hidden Liquidity Alerts</h1>
      {/* LiquidityAlertPanel — built in Phase 6 */}
      <p className="text-gray-500">Liquidity alerts will appear here once the 990 Audit Agent is running.</p>
    </main>
  );
}
