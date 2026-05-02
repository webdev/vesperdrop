import { Container } from "@/components/ui/container";

export function HowItWorks() {
  return (
    <section id="how" className="bg-paper py-20 md:py-24">
      <Container width="marketing">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:mb-16 md:flex-row">
          <div className="md:max-w-2xl">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
              How it works
            </p>
            <h2 className="mt-4 font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.02] tracking-[-0.02em] text-ink">
              Three steps.{" "}
              <em className="not-italic font-serif italic text-terracotta-dark">
                No camera.
              </em>
            </h2>
          </div>
          <p className="text-[15px] leading-[1.6] text-ink-3 md:max-w-sm md:text-right">
            We trained on 4,000+ conversion-tested references so your first
            generation looks like a tenth one. No prompts, no tweaking, no
            re-rolls.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-16">
          {[
            {
              n: "01",
              t: "Drop a photo",
              c: "Any flatlay, hanger, mannequin, or floor shot. Phone or studio. PNG or JPG up to 40MB.",
            },
            {
              n: "02",
              t: "Pick a few scenes",
              c: "Velvet glow, urban canvas, warm retreat, studio athletic — choose up to five looks.",
            },
            {
              n: "03",
              t: "Get six photos",
              c: "Watermarked previews in 90 seconds. One full-resolution HD shot free with sign-up.",
            },
          ].map((step) => (
            <li key={step.n} className="border-t border-line-soft pt-6">
              <p className="font-serif text-[clamp(4rem,6vw,6rem)] leading-[0.85] tracking-[-0.04em] text-ink">
                {step.n}
              </p>
              <h3 className="mt-5 font-serif text-[clamp(1.5rem,2vw,1.875rem)] leading-[1.1] tracking-[-0.01em] text-ink">
                {step.t}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.55] text-ink-3">
                {step.c}
              </p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
