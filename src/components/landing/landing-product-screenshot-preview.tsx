import {
  LANDING_MARKETING_SCREENSHOTS,
  LandingProductScreenshot,
} from "@/components/landing/landing-product-screenshot";

/**
 * Isolated preview for 0F-2 review — not linked from the public landing.
 */
export function LandingProductScreenshotPreview() {
  const { hero, showcase } = LANDING_MARKETING_SCREENSHOTS;

  return (
    <div className="min-h-dvh bg-pragma-soft-gray px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-16">
        <header className="space-y-2 text-center">
          <p className="font-accent text-[11px] font-semibold uppercase tracking-[0.14em] text-pragma-electric">
            0F-2 · Preview
          </p>
          <h1 className="font-heading text-2xl font-bold text-pragma-black">
            LandingProductScreenshot
          </h1>
          <p className="text-sm text-pragma-mid-gray">
            Componente aislado — sin cambios en hero ni showcase.
          </p>
        </header>

        <section className="space-y-4" aria-labelledby="preview-hero">
          <h2
            id="preview-hero"
            className="text-sm font-semibold text-pragma-black"
          >
            Hero slot · priority · light context
          </h2>
          <div className="mx-auto max-w-xl">
            <LandingProductScreenshot
              src={hero.src}
              alt={hero.alt}
              width={hero.width}
              height={hero.height}
              priority
            />
          </div>
        </section>

        <section
          className="space-y-4 rounded-3xl border border-white/15 bg-pragma-gradient-premium-dark p-6 md:p-10"
          aria-labelledby="preview-showcase"
        >
          <h2
            id="preview-showcase"
            className="text-sm font-semibold text-white"
          >
            Showcase slot · lazy · dark context
          </h2>
          <div className="mx-auto max-w-3xl">
            <LandingProductScreenshot
              src={showcase.src}
              alt={showcase.alt}
              width={showcase.width}
              height={showcase.height}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
