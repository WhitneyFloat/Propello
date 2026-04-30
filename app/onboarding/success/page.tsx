import { Suspense } from "react";
import SuccessContent from "./SuccessContent";

export default function SuccessPage() {
  return (
    <main className="min-h-screen bg-navy flex items-center justify-center px-6">
      <Suspense>
        <SuccessContent />
      </Suspense>
    </main>
  );
}
