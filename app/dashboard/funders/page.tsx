import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function FundersPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-navy p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Funder Profiles</h1>
      {/* FunderProfile components — built in Phase 6 */}
      <p className="text-gray-500">Funder profiles will appear here once the 990 Audit Agent populates the database.</p>
    </main>
  );
}
