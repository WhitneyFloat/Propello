export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <h1 className="text-5xl font-bold text-white mb-4">
        Your next grant is already out there.
        <span className="text-teal"> We&apos;ll find it.</span>
      </h1>
      <p className="text-xl text-gray-400 max-w-2xl mb-8">
        Propello is a Private Fundraising Intelligence Network — a Development
        Director-as-a-Service platform built for nonprofits who are serious
        about funding.
      </p>
      <a
        href="/onboarding"
        className="bg-teal text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-opacity-90 transition"
      >
        Get Started Free
      </a>
    </section>
  );
}
