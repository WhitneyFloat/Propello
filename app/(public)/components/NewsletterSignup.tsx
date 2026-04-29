"use client";

export default function NewsletterSignup() {
  return (
    <section className="py-24 px-6 text-center">
      <h2 className="text-3xl font-bold text-white mb-4">
        Get the weekly grant radar. Free.
      </h2>
      <p className="text-gray-400 mb-8 max-w-xl mx-auto">
        Top 3 national funding opportunities every Thursday. No fluff.
      </p>
      <form
        className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="email"
          placeholder="your@nonprofit.org"
          className="flex-1 bg-charcoal border border-teal/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-teal"
        />
        <button
          type="submit"
          className="bg-teal text-white px-6 py-3 rounded-lg font-semibold hover:bg-opacity-90 transition whitespace-nowrap"
        >
          Subscribe Free
        </button>
      </form>
    </section>
  );
}
