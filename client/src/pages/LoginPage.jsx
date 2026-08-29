import { useId, useState } from "react";
import { Lock, Mail, Sparkles, BarChart3, Send } from "lucide-react";
import { login } from "../api.js";
import logo from "../logo.webp";

/** A small floating icon card, purely decorative. */
function IconChip({ icon: Icon, className, rotate = 0 }) {
  return (
    <div
      className={`absolute hidden h-14 w-14 items-center justify-center rounded-2xl bg-white lg:flex ${className}`}
      style={{
        boxShadow: "0 10px 26px rgb(var(--navy-rgb)/0.12), 0 2px 6px rgb(var(--navy-rgb)/0.06)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <Icon size={22} className="text-[var(--violet)]" />
    </div>
  );
}

/** Dashed arcs linking the icon chips back toward the card - purely decorative. */
function ConnectorLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      viewBox="0 0 1600 900"
      preserveAspectRatio="none"
      fill="none"
    >
      <path
        d="M 230 190 C 420 90, 620 90, 800 260"
        stroke="rgb(var(--violet-rgb) / 0.28)"
        strokeWidth="2"
        strokeDasharray="6 8"
      />
      <path
        d="M 1370 190 C 1180 90, 980 90, 830 250"
        stroke="rgb(var(--violet-rgb) / 0.28)"
        strokeWidth="2"
        strokeDasharray="6 8"
      />
      <path
        d="M 1300 470 C 1180 470, 1050 470, 940 480"
        stroke="rgb(var(--violet-rgb) / 0.28)"
        strokeWidth="2"
        strokeDasharray="6 8"
      />
    </svg>
  );
}

/** A stylized envelope-with-letter graphic, bottom-left - purely decorative. */
function EnvelopeArt() {
  return (
    <div className="absolute bottom-[8%] left-[6%] hidden lg:block">
      <div className="relative h-40 w-52">
        <div
          className="absolute left-4 top-0 h-32 w-40 -rotate-6 rounded-lg bg-white"
          style={{ boxShadow: "0 16px 40px rgb(var(--navy-rgb)/0.12)" }}
        >
          <div className="absolute left-4 top-5 h-1.5 w-28 rounded-full bg-[rgb(var(--violet-rgb)/0.14)]" />
          <div className="absolute left-4 top-10 h-1.5 w-24 rounded-full bg-[rgb(var(--violet-rgb)/0.14)]" />
          <div className="absolute left-4 top-15 h-1.5 w-20 rounded-full bg-[rgb(var(--violet-rgb)/0.14)]" />
        </div>
        <svg
          viewBox="0 0 200 130"
          className="absolute bottom-0 left-0 h-32 w-48"
          style={{ filter: "drop-shadow(0 14px 30px rgb(12 8 40 / 0.14))" }}
        >
          <rect x="4" y="4" width="192" height="122" rx="10" fill="#ffffff" />
          <path d="M 4 14 L 100 80 L 196 14" fill="none" stroke="rgb(var(--violet-rgb) / 0.35)" strokeWidth="4" />
        </svg>
        <div
          className="absolute -right-3 -bottom-3 flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(135deg, rgb(var(--violet-rgb)), rgb(var(--royal-rgb)))",
            boxShadow: "0 8px 20px rgb(var(--royal-rgb)/0.35)",
          }}
        >
          <Send size={16} className="text-white" />
        </div>
      </div>
    </div>
  );
}

/** Loosely flowing lines, bottom-right corner - purely decorative. */
function WaveArt() {
  return (
    <svg
      className="pointer-events-none absolute bottom-0 right-0 hidden h-[46%] w-[46%] lg:block"
      viewBox="0 0 600 400"
      preserveAspectRatio="xMaxYMax meet"
      fill="none"
    >
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M -20 ${330 - i * 26} C 150 ${260 - i * 26}, 320 ${420 - i * 26}, 620 ${210 - i * 26}`}
          stroke="rgb(var(--violet-rgb) / 0.14)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

/** A repeating dot-grid pattern in one corner - purely decorative. */
function DotGrid({ className }) {
  const patternId = useId();
  return (
    <svg className={`pointer-events-none absolute hidden h-28 w-28 lg:block ${className}`} viewBox="0 0 100 100">
      <pattern id={patternId} width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="2" fill="rgb(var(--violet-rgb) / 0.22)" />
      </pattern>
      <rect width="100" height="100" fill={`url(#${patternId})`} />
    </svg>
  );
}

/** The single shared-password gate in front of the whole app - see server/services/authToken.js. */
export default function LoginPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="executive-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="exec-blob-mid" />

      <DotGrid className="left-[6%] top-[8%]" />
      <DotGrid className="bottom-[10%] right-[8%]" />
      <WaveArt />
      <ConnectorLines />
      <EnvelopeArt />
      <IconChip icon={Mail} className="left-[16%] top-[16%]" rotate={-6} />
      <IconChip icon={Sparkles} className="right-[20%] top-[12%]" rotate={6} />
      <IconChip icon={BarChart3} className="right-[10%] top-[42%]" rotate={-4} />
      <Send
        size={40}
        className="pointer-events-none absolute right-[8%] top-[14%] hidden -rotate-12 text-[var(--violet)] opacity-70 lg:block"
      />

      <form
        onSubmit={handleSubmit}
        className="executive-glass relative z-10 w-full max-w-sm p-8 text-center"
      >
        <img src={logo} alt="Ergode" className="mx-auto h-16 w-16" />
        <h1 className="mt-4 text-xl font-semibold">Ergode AI</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Sign in to the CRM assistant</p>

        <div className="mt-6 text-left">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Password
          </label>
          <div className="relative mt-1">
            <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="password"
              autoFocus
              className="brand-input w-full rounded-lg py-2 pl-9 pr-3 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Shared team password"
            />
          </div>
        </div>

        {error && <p className="mt-3 text-left text-sm text-[var(--executive-error)]">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !password}
          className="brand-button mt-6 w-full px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
