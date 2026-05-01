/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const PAIRS = [
  {
    sku: "JKT-204",
    label: "Jacket",
    scene: "Urban canvas",
    before: "/marketing/before-after/jacket_before.png",
    after: "/marketing/before-after/jacket_after.png",
  },
  {
    sku: "SKT-018",
    label: "Skirt",
    scene: "Warm retreat",
    before: "/marketing/before-after/skirt_before.png",
    after: "/marketing/before-after/skirt_after.png",
  },
  {
    sku: "LCE-115",
    label: "Lace",
    scene: "Studio athletic",
    before: "/marketing/before-after/lace_before.png",
    after: "/marketing/before-after/lace_after.png",
  },
];

export function BeforeAfterSection() {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-14 grid grid-cols-1 items-end gap-6 md:mb-20 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
              Real before / after
            </p>
            <h2 className="mt-3 text-[clamp(32px,4.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.02em] text-zinc-900">
              Flatlays in.{" "}
              <span className="text-zinc-600">Lifestyle out.</span>
            </h2>
          </div>
          <p className="text-[16px] leading-[1.6] text-zinc-600 md:max-w-md md:justify-self-end">
            Same product, same upload — three different scenes. No props,
            no models, no studio. Ninety seconds each.
          </p>
        </div>

        <div className="space-y-6">
          {PAIRS.map((p) => (
            <article
              key={p.sku}
              className="overflow-hidden rounded-[20px] border border-zinc-200 bg-zinc-50/60"
            >
              <div className="grid grid-cols-1 md:grid-cols-2">
                <figure className="relative aspect-[4/5] bg-white">
                  <img
                    src={p.before}
                    alt={`${p.label} — original flatlay`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  <figcaption className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-zinc-900/85 px-3 py-1 text-[10px] font-medium tracking-wide text-white backdrop-blur-sm">
                    Before · Your photo
                  </figcaption>
                </figure>
                <figure className="relative aspect-[4/5] bg-white">
                  <img
                    src={p.after}
                    alt={`${p.label} — lifestyle generation in ${p.scene.toLowerCase()}`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  <figcaption className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-orange-500 px-3 py-1 text-[10px] font-medium tracking-wide text-white">
                    After · Vesperdrop
                  </figcaption>
                </figure>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-zinc-200 bg-white px-5 py-4 text-[12px] tracking-wide text-zinc-500">
                <span className="text-zinc-700">
                  <span className="font-medium text-zinc-900">{p.label}</span>{" "}
                  · {p.sku}
                </span>
                <span>Scene · {p.scene}</span>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/try"
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-7 py-3.5 text-[15px] font-medium text-white transition-transform hover:scale-[1.02] hover:bg-zinc-800"
          >
            Try with your photo <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
