import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function GrantsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main className="min-h-screen bg-navy p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Grant Match Feed</h1>
      {/* GrantFeed component — built in Phase 6 */}
      <p className="text-gray-500">Grants will appear here once the Mission-Match Engine is running.</p>
    </main>
  );
}
