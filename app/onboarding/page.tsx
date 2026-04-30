"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const NTEE_CODES = [
  { value: "A", label: "A — Arts, Culture & Humanities" },
  { value: "B", label: "B — Education" },
  { value: "C", label: "C — Environment" },
  { value: "D", label: "D — Animal-Related" },
  { value: "E", label: "E — Health Care" },
  { value: "F", label: "F — Mental Health & Crisis Intervention" },
  { value: "G", label: "G — Disease & Disorder Research" },
  { value: "H", label: "H — Medical Research" },
  { value: "I", label: "I — Crime & Legal-Related" },
  { value: "J", label: "J — Employment" },
  { value: "K", label: "K — Food, Agriculture & Nutrition" },
  { value: "L", label: "L — Housing & Shelter" },
  { value: "M", label: "M — Public Safety & Disaster Relief" },
  { value: "N", label: "N — Recreation & Sports" },
  { value: "O", label: "O — Youth Development" },
  { value: "P", label: "P — Human Services" },
  { value: "Q", label: "Q — International" },
  { value: "R", label: "R — Civil Rights & Advocacy" },
  { value: "S", label: "S — Community Improvement" },
  { value: "T", label: "T — Philanthropy & Voluntarism" },
  { value: "U", label: "U — Science & Technology" },
  { value: "W", label: "W — Public & Societal Benefit" },
  { value: "X", label: "X — Religion-Related" },
];

const PROGRAM_TYPE_OPTIONS = [
  "Direct Services", "Advocacy & Policy", "Education & Training",
  "Community Organizing", "Research", "Capacity Building",
  "Housing", "Food Access", "Mental Health", "Youth Programs",
  "Workforce Development", "Legal Aid", "Arts & Culture",
  "Environmental Justice", "Health Services",
];

const BUDGET_TIERS = [
  { label: "Under $100K", value: "<$100K", minimum: 0 },
  { label: "$100K – $500K", value: "$100K-$500K", minimum: 100000 },
  { label: "$500K – $1M", value: "$500K-$1M", minimum: 500000 },
  { label: "$1M – $5M", value: "$1M-$5M", minimum: 1000000 },
  { label: "$5M+", value: "$5M+", minimum: 5000000 },
];

type FormData = {
  org_name: string;
  mission_statement: string;
  ntee_code: string;
  primary_geo: string;
  program_types: string[];
  annual_budget: string;
  staff_count: string;
};

const EMPTY_FORM: FormData = {
  org_name: "",
  mission_statement: "",
  ntee_code: "",
  primary_geo: "",
  program_types: [],
  annual_budget: "",
  staff_count: "",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleProgramType(type: string) {
    setForm((f) => ({
      ...f,
      program_types: f.program_types.includes(type)
        ? f.program_types.filter((t) => t !== type)
        : [...f.program_types, type],
    }));
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      router.push(`/onboarding/success?profile_id=${data.profile_id}&tier=${data.tier}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-navy flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="flex gap-2 mb-10">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all ${
                s <= step ? "bg-teal" : "bg-charcoal"
              }`}
            />
          ))}
        </div>

        <div className="bg-charcoal rounded-2xl p-8 border border-teal/20">
          {step === 1 && (
            <Step1
              form={form}
              onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <Step2
              form={form}
              onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
              onToggleProgramType={toggleProgramType}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && (
            <Step3
              form={form}
              onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
              onBack={() => setStep(2)}
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function Step1({
  form,
  onChange,
  onNext,
}: {
  form: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  onNext: () => void;
}) {
  const valid = form.org_name.trim().length > 0 && form.mission_statement.trim().length > 20;
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">Tell us about your organization.</h1>
      <p className="text-gray-400 mb-8">We&apos;ll handle the rest.</p>

      <label className="block mb-6">
        <span className="text-sm text-gray-400 mb-1 block">Organization name *</span>
        <input
          type="text"
          value={form.org_name}
          onChange={(e) => onChange("org_name", e.target.value)}
          placeholder="Harlem Children's Society"
          className="w-full bg-navy border border-teal/30 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-teal"
        />
      </label>

      <label className="block mb-8">
        <span className="text-sm text-gray-400 mb-1 block">Mission statement *</span>
        <textarea
          value={form.mission_statement}
          onChange={(e) => onChange("mission_statement", e.target.value)}
          placeholder="We provide after-school programming and mentorship to underserved youth in Upper Manhattan..."
          rows={4}
          className="w-full bg-navy border border-teal/30 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-teal resize-none"
        />
        <span className="text-xs text-gray-600 mt-1 block">
          The more specific, the better your grant matches will be.
        </span>
      </label>

      <button
        onClick={onNext}
        disabled={!valid}
        className="w-full bg-teal text-white py-3 rounded-lg font-semibold disabled:opacity-40 hover:bg-opacity-90 transition"
      >
        Continue
      </button>
    </div>
  );
}

function Step2({
  form,
  onChange,
  onToggleProgramType,
  onBack,
  onNext,
}: {
  form: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  onToggleProgramType: (t: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const valid = form.ntee_code && form.primary_geo.trim().length > 0 && form.program_types.length > 0;
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">What does your work focus on?</h1>
      <p className="text-gray-400 mb-8">This powers your mission-match scoring.</p>

      <label className="block mb-6">
        <span className="text-sm text-gray-400 mb-1 block">NTEE category *</span>
        <select
          value={form.ntee_code}
          onChange={(e) => onChange("ntee_code", e.target.value)}
          className="w-full bg-navy border border-teal/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-teal"
        >
          <option value="">Select a category</option>
          {NTEE_CODES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>

      <label className="block mb-6">
        <span className="text-sm text-gray-400 mb-1 block">Primary geography *</span>
        <input
          type="text"
          value={form.primary_geo}
          onChange={(e) => onChange("primary_geo", e.target.value)}
          placeholder="New York City, NY"
          className="w-full bg-navy border border-teal/30 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-teal"
        />
      </label>

      <div className="mb-8">
        <span className="text-sm text-gray-400 mb-3 block">Program types * (select all that apply)</span>
        <div className="flex flex-wrap gap-2">
          {PROGRAM_TYPE_OPTIONS.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onToggleProgramType(type)}
              className={`px-3 py-1.5 rounded-full text-sm transition border ${
                form.program_types.includes(type)
                  ? "bg-teal border-teal text-white"
                  : "bg-navy border-teal/20 text-gray-400 hover:border-teal/50"
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-teal/30 text-gray-400 py-3 rounded-lg hover:border-teal/60 transition">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!valid}
          className="flex-1 bg-teal text-white py-3 rounded-lg font-semibold disabled:opacity-40 hover:bg-opacity-90 transition"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function Step3({
  form,
  onChange,
  onBack,
  onSubmit,
  loading,
  error,
}: {
  form: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
  error: string;
}) {
  const valid = form.annual_budget && form.staff_count;
  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-1">A few more details.</h1>
      <p className="text-gray-400 mb-8">Used to filter grants by award size and org capacity.</p>

      <div className="mb-6">
        <span className="text-sm text-gray-400 mb-3 block">Annual budget *</span>
        <div className="grid grid-cols-1 gap-2">
          {BUDGET_TIERS.map((tier) => (
            <button
              key={tier.value}
              type="button"
              onClick={() => onChange("annual_budget", tier.value)}
              className={`text-left px-4 py-3 rounded-lg border transition ${
                form.annual_budget === tier.value
                  ? "border-teal bg-teal/10 text-white"
                  : "border-teal/20 text-gray-400 hover:border-teal/50"
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block mb-8">
        <span className="text-sm text-gray-400 mb-1 block">Full-time staff count *</span>
        <input
          type="number"
          min="0"
          value={form.staff_count}
          onChange={(e) => onChange("staff_count", e.target.value)}
          placeholder="12"
          className="w-full bg-navy border border-teal/30 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-teal"
        />
      </label>

      {error && (
        <p className="text-red-400 text-sm mb-4">{error}</p>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 border border-teal/30 text-gray-400 py-3 rounded-lg hover:border-teal/60 transition">
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!valid || loading}
          className="flex-1 bg-teal text-white py-3 rounded-lg font-semibold disabled:opacity-40 hover:bg-opacity-90 transition"
        >
          {loading ? "Setting up your profile…" : "Launch my grant radar"}
        </button>
      </div>
    </div>
  );
}
