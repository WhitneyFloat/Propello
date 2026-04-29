import Hero from "./components/Hero";
import GrantTicker from "./components/GrantTicker";
import NewsletterSignup from "./components/NewsletterSignup";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-navy">
      <Hero />
      <GrantTicker />
      <NewsletterSignup />
    </main>
  );
}
