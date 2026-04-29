"use client";

import { useState } from "react";

type Step = "phone" | "code" | "done";

function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);
  if (digits.length <= 3) return a;
  if (digits.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

export default function SignupCard() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("You need to agree to receive alerts.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setMaskedPhone(data.maskedPhone);
      setDevCode(data.devCode ?? null);
      setStep("code");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Invalid code");
        return;
      }
      setStep("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "done") {
    return (
      <div className="card rounded-2xl p-6 text-left">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-400/20 text-emerald-300">
            ✓
          </span>
          <h2 className="text-lg font-bold">You&apos;re in.</h2>
        </div>
        <p className="text-sm text-white/70">
          We&apos;ll text {maskedPhone} the second a Pokémon TCG card product
          drops at one of the six retailers. Reply{" "}
          <span className="font-mono text-white">STOP</span> any time to opt
          out.
        </p>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form
        onSubmit={handleCodeSubmit}
        className="card rounded-2xl p-6 text-left"
      >
        <h2 className="mb-1 text-lg font-bold">Enter the code</h2>
        <p className="mb-5 text-sm text-white/60">
          We sent a 6-digit code to {maskedPhone}.
        </p>
        {devCode && (
          <div className="mb-4 rounded-xl border border-yellow-300/30 bg-yellow-300/10 px-3 py-2 text-xs text-yellow-200">
            <span className="font-semibold">DEV MODE:</span> code is{" "}
            <span className="font-mono text-base text-yellow-100">{devCode}</span>{" "}
            (no SMS sent)
          </div>
        )}
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="input w-full rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em]"
          placeholder="000000"
        />
        {error && (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="btn-primary mt-5 w-full rounded-xl px-4 py-3"
        >
          {loading ? "Verifying…" : "Verify & subscribe"}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setError(null);
            setCode("");
          }}
          className="mt-3 w-full text-xs text-white/50 hover:text-white/80"
        >
          ← Use a different number
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handlePhoneSubmit}
      className="card rounded-2xl p-6 text-left"
    >
      <label
        htmlFor="phone"
        className="mb-2 block text-xs font-semibold uppercase tracking-widest text-white/60"
      >
        Mobile number (US only)
      </label>
      <div className="flex items-stretch gap-2">
        <span className="input grid place-items-center rounded-xl px-3 text-sm text-white/70">
          +1
        </span>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          value={phone}
          onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
          className="input w-full rounded-xl px-4 py-3 text-base"
          placeholder="(555) 555-5555"
        />
      </div>

      <label className="mt-4 flex items-start gap-3 text-xs text-white/60">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-yellow-300"
        />
        <span>
          I agree to receive recurring automated text alerts about Pokémon TCG
          drops. Msg &amp; data rates may apply. Reply{" "}
          <span className="font-mono text-white/80">STOP</span> to cancel.
        </span>
      </label>

      {error && (
        <p className="mt-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || phone.replace(/\D/g, "").length !== 10}
        className="btn-primary mt-5 w-full rounded-xl px-4 py-3"
      >
        {loading ? "Sending code…" : "Get drop alerts"}
      </button>
    </form>
  );
}
