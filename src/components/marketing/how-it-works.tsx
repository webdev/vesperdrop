import Link from "next/link";
import { Container } from "@/components/ui/container";

export function HowItWorks() {
  return (
    <section id="how" className="bg-paper py-20 md:py-24">
      <Container width="marketing">
        <div className="mb-12 flex flex-col items-end justify-between gap-6 md:mb-16 md:flex-row">
          <div className="text-center md:max-w-2xl md:text-left">
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
          <p className="hidden text-[15px] leading-[1.6] text-ink-3 md:block md:max-w-sm md:text-right">
            One flat lay in. Six lifestyle photos out. Your first one is on
            us, full resolution, no card required.
          </p>
        </div>

        <ol className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-16">
          {[
            {
              n: "01",
              t: "Upload your flat lay",
              c: "Drop in a phone photo of your garment. Any lighting, any background.",
            },
            {
              n: "02",
              t: "Choose your scenes",
              c: "Pick from urban, studio, lifestyle, golden hour, and more.",
            },
            {
              n: "03",
              t: "Get your photos",
              c: "Six on-model lifestyle shots. Watermark-free with email, ready to post.",
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

        <div className="mt-12 flex flex-col items-center gap-3 md:mt-16 md:flex-row md:justify-center">
          <Link
            href="/try"
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-6 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-terracotta-dark"
          >
            Get my first photo free
            <span aria-hidden>→</span>
          </Link>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
            No card required
          </p>
        </div>
      </Container>
    </section>
  );
}
