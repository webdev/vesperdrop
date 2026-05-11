import { Container } from "@/components/ui/container";
import type { PlanMarketing } from "@/lib/plans";
import { HeroPair } from "./hero-pair";
import { ComparisonTable, type ComparisonRow } from "./comparison-table";

export interface PricingCardsProps {
  free: PlanMarketing;
  pro: PlanMarketing;
  rows: ComparisonRow[];
}

export function PricingCards({ free, pro, rows }: PricingCardsProps) {
  return (
    <Container width="marketing" className="pb-24 pt-2">
      <HeroPair free={free} pro={pro} />
      <ComparisonTable rows={rows} />
      <CustomPlansCallout />
      <Notes />
      <Footer />
    </Container>
  );
}

function CustomPlansCallout() {
  return (
    <div className="mb-10 rounded-xl border border-line bg-paper-soft p-8 md:p-10">
      <h2 className="font-serif text-[28px] leading-tight tracking-[-0.01em] text-ink">
        Need more than 1,500 photos a month?
      </h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-[1.55] text-ink-3">
        Custom plans for big brands, agencies, and high volume sellers. API access, team seats, and white label available.
      </p>
      <a
        href="/contact?source=pricing-custom"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream transition-colors hover:bg-ink-2"
      >
        Contact us
      </a>
    </div>
  );
}

function Notes() {
  return (
    <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Overage</p>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
          $0.50 per photo past your monthly limit on Starter, Pro, and Studio. $0.40 on Agency. Billed transparently, no surprises.
        </p>
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">Annual billing</p>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-3">
          Save 20% on any tier. Cancel any time during your billing period.
        </p>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-dashed border-line px-6 py-5 sm:flex-row">
      <p className="text-[14px] font-medium text-ink">Billing by Stripe</p>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-3">
        Secure, cancel any time, no hidden fees
      </p>
    </div>
  );
}
