export function HowItWorks() {
  return (
    <section id="how" className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 md:px-10">
        <div className="mb-12 grid grid-cols-1 items-end gap-6 md:mb-20 md:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] text-zinc-500 uppercase">
              How it works
            </p>
            <h2 className="mt-3 text-[clamp(32px,4.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.02em] text-zinc-900">
              Three steps. <span className="text-zinc-600">No camera.</span>
            </h2>
          </div>
          <p className="text-[16px] leading-[1.6] text-zinc-600 md:max-w-md md:justify-self-end">
            We trained on 4,000+ conversion-tested references so your first
            generation looks like a tenth one. No prompts, no tweaking, no
            re-rolls.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
            <div
              key={step.n}
              className="rounded-[20px] border border-zinc-200 bg-zinc-50/60 p-7 md:p-8"
            >
              <div className="text-[14px] font-medium tracking-tight text-orange-600">
                {step.n}
              </div>
              <h3 className="mt-3 text-[22px] font-semibold tracking-tight text-zinc-900">
                {step.t}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.55] text-zinc-600">
                {step.c}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
