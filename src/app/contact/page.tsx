import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { CommercialContactButton } from "@/components/landing/commercial-contact-button";
import { BackLink } from "@/components/ui/back-link";
import { LeadCaptureForm } from "@/features/leads/components/lead-capture-form";
import { getLandingSession } from "@/lib/landing-session.server";

export default async function ContactPage() {
  const session = await getLandingSession();

  return (
    <div className="min-h-screen bg-white text-pragma-black antialiased">
      <LandingNav session={session} />
      <main className="mx-auto max-w-xl px-6 py-16">
        <BackLink href="/" label="Inicio" className="mb-6" />
        <h1 className="font-heading text-2xl font-bold md:text-3xl">Contacto comercial</h1>
        <p className="mt-3 text-pragma-mid-gray">
          Cuéntanos sobre tu operación. Un especialista te orientará sobre el plan adecuado.
        </p>
        <div className="mt-8 rounded-2xl border p-6 shadow-sm">
          <LeadCaptureForm source="contact-page" />
        </div>
        <div className="mt-6 flex justify-center">
          <CommercialContactButton label="Agendar una llamada" variant="outline" />
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
