import SignupCard from "./SignupCard";

const RETAILERS = [
  { name: "Pokémon Center", domain: "pokemoncenter.com" },
  { name: "Target", domain: "target.com" },
  { name: "Walmart", domain: "walmart.com" },
  { name: "Best Buy", domain: "bestbuy.com" },
  { name: "GameStop", domain: "gamestop.com" },
  { name: "Costco", domain: "costco.com" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center px-5 pb-20 pt-12 sm:pt-20">
      <header className="mb-10 flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-yellow-300 to-red-400 text-base font-black text-[#0b0b14]">
            P
          </div>
          <span className="text-sm font-semibold tracking-wide text-white/80">
            Pokémon Drop Alerts
          </span>
        </div>
        <a
          href="#how-it-works"
          className="hidden text-xs text-white/60 hover:text-white/90 sm:inline"
        >
          How it works
        </a>
      </header>

      <section className="flex w-full flex-col items-center text-center">
        <span className="chip mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-widest text-white/70">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live monitoring · 6 retailers
        </span>
        <h1 className="glow text-4xl font-black leading-tight tracking-tight sm:text-6xl">
          Get a text the second
          <br />
          Pokémon TCG cards drop.
        </h1>
        <p className="mt-5 max-w-xl text-base text-white/70 sm:text-lg">
          Free SMS alerts the moment booster boxes, ETBs, tins, and new sets
          land at the major US retailers. Pop your number in. We&apos;ll handle
          the F5.
        </p>

        <div className="mt-10 w-full max-w-md">
          <SignupCard />
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 text-xs">
          {RETAILERS.map((r) => (
            <span
              key={r.domain}
              className="chip rounded-full px-3 py-1.5 text-white/70"
            >
              {r.name}
            </span>
          ))}
        </div>
      </section>

      <section
        id="how-it-works"
        className="mt-24 grid w-full max-w-3xl gap-4 sm:grid-cols-3"
      >
        {[
          {
            n: "1",
            t: "Verify your number",
            d: "Enter a US phone number and confirm with a 6-digit code. One-time consent only.",
          },
          {
            n: "2",
            t: "We watch the drops",
            d: "Our worker checks Pokémon TCG card inventory across 6 retailers every few minutes.",
          },
          {
            n: "3",
            t: "You get the text",
            d: "When a card product restocks or a new release lands, you get a tap-and-go link.",
          },
        ].map((s) => (
          <div key={s.n} className="card rounded-2xl p-5">
            <div className="mb-3 grid h-7 w-7 place-items-center rounded-full bg-white/10 text-xs font-bold text-white/80">
              {s.n}
            </div>
            <div className="text-sm font-semibold text-white">{s.t}</div>
            <p className="mt-1 text-sm text-white/60">{s.d}</p>
          </div>
        ))}
      </section>

      <footer className="mt-20 w-full max-w-3xl text-center text-xs text-white/40">
        <p>
          Reply <span className="font-mono text-white/70">STOP</span> to any
          alert to unsubscribe ·{" "}
          <span className="font-mono text-white/70">HELP</span> for support.
          Msg &amp; data rates may apply. Card products only — no plush, no
          accessories, no spam.
        </p>
        <p className="mt-3 text-white/30">
          Not affiliated with Nintendo, The Pokémon Company, or any retailer.
        </p>
      </footer>
    </main>
  );
}
