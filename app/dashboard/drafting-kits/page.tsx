import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DraftingKitsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-navy p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Drafting Kit Library</h1>
      {/* DraftingKit components — built in Phase 6, Tier 2 only */}
      <p className="text-gray-500">Your personalized drafting kits will appear here. Available on the Growth plan.</p>
    </main>
  );
}
