export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-navy flex items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">Tell us about your mission.</h1>
        <p className="text-gray-400 mb-8">We&apos;ll handle the rest.</p>
        {/* OnboardingForm component — built in Phase 2 (Agent 1) */}
        <div className="bg-charcoal rounded-xl p-8 border border-teal/20">
          <p className="text-gray-500">Onboarding form — built in Phase 2.</p>
        </div>
      </div>
    </main>
  );
}
