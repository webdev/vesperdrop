import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { AuthForm } from "@/components/app/auth-form";
import { SiteNav } from "@/components/marketing/site-nav";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Vesperdrop account.",
  alternates: { canonical: "/sign-in" },
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <SiteNav />

      <main className="flex-1 py-12 md:py-16">
        <Container width="marketing">
          {/* Editorial split card */}
          <div className="overflow-hidden rounded-2xl border border-line-soft bg-surface shadow-soft md:grid md:grid-cols-2">
            {/* Left — warm product/lifestyle image with quote overlay */}
            <div className="relative hidden min-h-[640px] md:block">
              <Image
                src="/marketing/before-after/cami_after.png"
                alt=""
                fill
                priority
                sizes="(max-width: 768px) 0vw, 50vw"
                className="object-cover"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent"
              />
              <figure className="absolute inset-x-0 bottom-0 px-9 pb-10 text-cream">
                <blockquote className="font-serif text-[clamp(1.25rem,1.6vw,1.5rem)] leading-[1.35] tracking-[-0.005em] italic">
                  &ldquo;Professional imagery without the photoshoot.&rdquo;
                </blockquote>
                <figcaption className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-cream/75">
                  Sarah K. · Small business owner
                </figcaption>
              </figure>
            </div>

            {/* Right — sign-in form */}
            <div className="px-7 py-10 md:px-12 md:py-14">
              <h1 className="font-serif text-[clamp(2.25rem,3vw,3rem)] leading-[1.05] tracking-[-0.02em] text-ink">
                Welcome back
              </h1>
              <p className="mt-2 text-[14px] text-ink-3">
                Sign in to your Vesperdrop account
              </p>

              <div className="mt-8">
                <Suspense>
                  <AuthForm mode="sign-in" variant="split" />
                </Suspense>
              </div>

              <p className="mt-8 text-center text-[14px] text-ink-3">
                Don&rsquo;t have an account?{" "}
                <Link
                  href="/sign-up"
                  className="font-medium text-terracotta underline-offset-4 transition-colors hover:text-terracotta-dark hover:underline"
                >
                  Create account
                </Link>
              </p>
            </div>
          </div>

          {/* Trust notes */}
          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
            <TrustNote
              title="AI-powered studio"
              body="Create impactful product imagery in seconds."
              icon={<StudioIcon />}
            />
            <TrustNote
              title="Your data is safe"
              body="We never sell or share your photos or personal information."
              icon={<ShieldIcon />}
            />
            <TrustNote
              title="Cancel anytime"
              body="No long contracts. Upgrade, downgrade, or cancel any time."
              icon={<CancelIcon />}
            />
          </div>
        </Container>
      </main>

      {/* Minimal sign-in footer */}
      <footer className="border-t border-line-soft py-7">
        <Container width="marketing" className="flex flex-col items-start justify-between gap-3 text-[12px] text-ink-4 md:flex-row md:items-center">
          <span className="font-mono uppercase tracking-[0.12em]">
            © 2026 Vesperdrop
          </span>
          <nav className="flex flex-wrap gap-5 font-mono uppercase tracking-[0.12em]">
            <Link href="/privacy" className="transition-colors hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-ink">
              Terms
            </Link>
            <Link href="/contact" className="transition-colors hover:text-ink">
              Contact
            </Link>
          </nav>
        </Container>
      </footer>
    </div>
  );
}

function TrustNote({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-soft bg-paper-soft text-ink-2">
        {icon}
      </div>
      <h3 className="mt-4 font-serif text-[16px] leading-[1.2] tracking-[-0.005em] text-ink">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-ink-3">{body}</p>
    </div>
  );
}

function StudioIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3.5" />
      <path d="M8 6V4h8v2" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}
