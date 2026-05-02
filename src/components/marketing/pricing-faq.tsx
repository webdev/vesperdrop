import { Container } from "@/components/ui/container";
import { FaqJsonLd } from "./structured-data";

const FAQ = [
  {
    q: "What's a credit?",
    a: "One credit = one generated lifestyle image at full 2000px resolution. Your free shot, watermarked previews, and re-generations all use the same credit pool. Credits roll over and never expire within your billing period.",
  },
  {
    q: "What does the free tier actually give me?",
    a: "One full-resolution HD generation (no watermark, yours to keep) plus 5 watermarked 720p previews — no card required. You see a real result in ~90 seconds, then decide whether to subscribe.",
  },
  {
    q: "What's the watermark on the free previews?",
    a: "A diagonal stripe watermark across the 720p preview images. The moment you upgrade — even mid-session — the same images re-generate at full 2000px with no watermark. You see the upgrade happen in real time.",
  },
  {
    q: "How fast is a generation?",
    a: "Free previews (Flux Schnell) appear in ~8 seconds. Paid HD generations (Flux 1.1 Pro / Nano Banana 2) take 60–90 seconds per image. Pro subscribers get priority queue, so your jobs run first.",
  },
  {
    q: "Can I cancel any time?",
    a: "Yes — cancel from your account dashboard at any moment. You keep access and your remaining credits through the end of the current billing period. No questions asked.",
  },
  {
    q: "Do I own the images?",
    a: "Yes. Every generated image is yours to use commercially — Shopify, Amazon A+ content, Meta ads, TikTok Shop, your website. No attribution required.",
  },
  {
    q: "What about my source photos?",
    a: "Uploads are stored privately and used only to generate your batch. They're never used for model training or shared with any third party.",
  },
  {
    q: "What happens when I run out of credits?",
    a: "You can top up with a one-time credit pack (10, 25, or 100 credits) without changing your subscription, or upgrade to the next tier. Subscribers always pay less per credit than one-time pack buyers.",
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
