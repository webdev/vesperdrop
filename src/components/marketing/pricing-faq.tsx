import { Container } from "@/components/ui/container";
import { FaqJsonLd } from "./structured-data";

const FAQ = [
  {
    q: "What counts as a photo?",
    a: "One photo equals one generated lifestyle image at full 2000px resolution. Watermarked previews on the free tier don't count against any plan since the free tier is its own thing.",
  },
  {
    q: "What happens if I go over my monthly photo limit?",
    a: "Your next photo still generates. Overage bills at $0.50 per photo on Starter, Pro, and Studio, and $0.40 per photo on Agency. The charge appears on your next invoice as a separate line, no surprises.",
  },
  {
    q: "Do unused photos roll over?",
    a: "No. Your photo allowance refreshes on your billing cycle anniversary. We considered roll-over but it makes capacity planning unpredictable on our side and most people prefer the simpler model.",
  },
  {
    q: "How does annual billing work?",
    a: "Annual subscribers get a 20% discount, billed once per year. We grant your monthly photo allocation each month rather than all upfront, so a heavy month doesn't burn through your year.",
  },
  {
    q: "Can I cancel?",
    a: "Yes, cancel from your account dashboard at any moment. You keep access through the end of your current billing period. No questions asked.",
  },
];

export function PricingFaq() {
  return (
    <section className="border-t border-line-soft bg-paper-soft py-20 md:py-28">
      <Container width="reading">
        <FaqJsonLd
          questions={FAQ.map((f) => ({ question: f.q, answer: f.a }))}
        />
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
          FAQ
        </p>
        <h2 className="mt-4 text-center font-serif text-[clamp(2rem,4vw,3rem)] leading-[1.05] tracking-[-0.02em] text-ink">
          Frequently asked.
        </h2>
        <div className="mt-14 divide-y divide-line-soft border-y border-line-soft">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-[clamp(1.125rem,1.4vw,1.25rem)] leading-[1.3] tracking-[-0.01em] text-ink">
                <span>{item.q}</span>
                <span
                  aria-hidden
                  className="font-mono text-[20px] leading-none text-ink-3 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-4 max-w-2xl text-[15px] leading-[1.6] text-ink-3">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
