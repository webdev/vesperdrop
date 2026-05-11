"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

const VOLUMES = ["<500", "500-1500", "1500-5000", "5000+"] as const;

type Status = "idle" | "submitting" | "ok" | "error";

export function ContactForm() {
  const params = useSearchParams();
  const source = params.get("source") ?? "contact-direct";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      company: String(fd.get("company") ?? ""),
      monthlyVolume: String(fd.get("monthlyVolume") ?? "<500"),
      message: String(fd.get("message") ?? "") || null,
      source,
      website: String(fd.get("website") ?? ""),
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus("ok");
        return;
      }
      if (res.status === 429) {
        setStatus("error");
        setError("Too many submissions. Try again in an hour.");
        return;
      }
      setStatus("error");
      setError("Something went wrong. Email hello@vesperdrop.com instead.");
    } catch {
      setStatus("error");
      setError("Network error. Email hello@vesperdrop.com instead.");
    }
  }

  if (status === "ok") {
    return (
      <div className="rounded-[20px] border border-line-soft bg-paper-soft p-8 text-center">
        <p className="font-serif text-[26px] leading-tight tracking-[-0.015em] text-ink">
          Thanks, we&rsquo;ll be in touch.
        </p>
        <p className="mt-3 text-[14px] leading-[1.6] text-ink-3">
          We read every message. Expect a reply within one business day.
        </p>
        <a
          href="/pricing"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink transition-colors hover:bg-cream"
        >
          Back to pricing
        </a>
      </div>
    );
  }

  const submitting = status === "submitting";

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-5">
      <Field label="Name" name="name" required autoComplete="name" />
      <Field
        label="Email"
        name="email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        label="Company or brand"
        name="company"
        required
        autoComplete="organization"
      />
      <div>
        <label
          htmlFor="contact-monthly-volume"
          className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3"
        >
          Monthly photo volume
        </label>
        <select
          id="contact-monthly-volume"
          name="monthlyVolume"
          required
          defaultValue="<500"
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:border-ink-2 focus:outline-none"
        >
          {VOLUMES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="contact-message"
          className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3"
        >
          Anything else (optional)
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={4}
          maxLength={2000}
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] leading-[1.55] text-ink focus:border-ink-2 focus:outline-none"
        />
      </div>

      {/* Honeypot. Visually hidden, must remain empty. */}
      <div aria-hidden="true" className="hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {error ? (
        <p role="alert" className="text-[13px] text-terracotta-dark">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Send"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const id = `contact-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="block font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:border-ink-2 focus:outline-none"
      />
    </div>
  );
}
