import Link from "next/link";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { BackLink } from "@/components/ui/back-link";
import { LeadCaptureForm } from "@/features/leads/components/lead-capture-form";
import { getLandingPrimaryCta } from "@/lib/landing-session";
import { getLandingSession } from "@/lib/landing-session.server";
import { Button } from "@/components/ui/button";

export default async function ContactPage() {
  const session = await getLandingSession();
  const primary = getLandingPrimaryCta(session);

  return (
    <div className="min-h-screen bg-white text-pragma-black antialiased">
      <LandingNav session={session} />
      <main className="mx-auto max-w-xl px-6 py-16">
        <BackLink href="/" label="Inicio" className="mb-6" />
        <h1 className="font-heading text-3xl font-bold">Contacto comercial</h1>
        <p className="mt-3 text-pragma-mid-gray">
          Cuéntanos sobre tu operación. También puedes activar la prueba cuando quieras usar
          el software.
        </p>
        <div className="mt-8 rounded-2xl border p-6 shadow-sm">
          <LeadCaptureForm source="contact-page" />
        </div>
        <Button variant="brandOutline" className="mt-6 w-full" asChild>
          <Link href={primary.href}>{primary.label}</Link>
        </Button>
      </main>
      <LandingFooter />
    </div>
  );
}
