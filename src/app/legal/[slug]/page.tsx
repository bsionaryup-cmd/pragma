import Link from "next/link";
import { notFound } from "next/navigation";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import {
  LEGAL_DOCUMENTS,
  type LegalDocumentSlug,
} from "@/lib/legal/documents";
import { EMPTY_LANDING_SESSION } from "@/lib/landing-session";

const SLUGS = Object.keys(LEGAL_DOCUMENTS) as LegalDocumentSlug[];

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

function isLegalSlug(value: string): value is LegalDocumentSlug {
  return SLUGS.includes(value as LegalDocumentSlug);
}

const LEGAL_DISCLAIMER =
  "PRAGMA es una herramienta tecnológica de gestión. El usuario es responsable de la operación de sus alojamientos, del cumplimiento normativo aplicable y de la veracidad de la información registrada.";

function documentSections(slug: LegalDocumentSlug): Array<{ title: string; body: string[] }> {
  switch (slug) {
    case "terminos":
      return [
        {
          title: "Uso del software",
          body: [
            "PRAGMA es un sistema de gestión para operadores de alojamientos. El acceso está sujeto a una cuenta activa y al plan contratado.",
            LEGAL_DISCLAIMER,
          ],
        },
        {
          title: "Pagos y cancelación",
          body: [
            "La suscripción se factura según el plan y número de propiedades activas. Puedes cancelar en cualquier momento; el acceso continúa hasta el final del periodo pagado.",
          ],
        },
        {
          title: "Suspensión",
          body: [
            "Podemos suspender cuentas por incumplimiento de pago, uso abusivo o violación de estos términos, previa notificación cuando sea razonable.",
          ],
        },
        {
          title: "Limitación de responsabilidad",
          body: [
            "PRAGMA no garantiza resultados comerciales específicos. No somos responsables por pérdidas indirectas derivadas del uso del software.",
          ],
        },
      ];
    case "privacidad":
      return [
        {
          title: "Datos que recopilamos",
          body: [
            "Datos de cuenta (nombre, correo), datos operativos (propiedades, reservas, huéspedes) y metadatos técnicos (IP, navegador) para seguridad y soporte.",
          ],
        },
        {
          title: "Uso y almacenamiento",
          body: [
            "Usamos los datos para operar el servicio, mejorar el producto y cumplir obligaciones legales. Los datos se almacenan en infraestructura cloud con medidas de seguridad razonables.",
          ],
        },
        {
          title: "Compartición",
          body: [
            "Compartimos datos solo con proveedores necesarios (autenticación, pagos, hosting) bajo acuerdos de confidencialidad.",
          ],
        },
      ];
    case "tratamiento-datos":
      return [
        {
          title: "Marco legal",
          body: [
            "El tratamiento de datos personales se realiza conforme a la Ley 1581 de 2012 y normas complementarias en Colombia.",
          ],
        },
        {
          title: "Finalidades",
          body: [
            "Gestión de reservas, huéspedes, finanzas operativas, integraciones autorizadas y soporte al cliente.",
          ],
        },
        {
          title: "Derechos del titular",
          body: [
            "Puedes solicitar acceso, rectificación o supresión de tus datos personales escribiendo a soporte desde la cuenta registrada.",
          ],
        },
      ];
    case "cookies":
      return [
        {
          title: "Qué son",
          body: [
            "Las cookies son archivos pequeños que el navegador almacena para mantener sesión, preferencias y medir uso básico.",
          ],
        },
        {
          title: "Cookies que usamos",
          body: [
            "Cookies esenciales de autenticación y preferencias de interfaz. No vendemos datos de cookies a terceros.",
          ],
        },
      ];
    case "suscripcion-saas":
      return [
        {
          title: "Licencia de uso",
          body: [
            "Se otorga una licencia limitada, no exclusiva e intransferible para usar PRAGMA mientras la suscripción esté activa.",
          ],
        },
        {
          title: "Propiedad intelectual",
          body: [
            "PRAGMA, su marca y código son propiedad del titular del servicio. No se transfieren derechos de propiedad al usuario.",
          ],
        },
        {
          title: "Soporte y disponibilidad",
          body: [
            "Buscamos alta disponibilidad pero no garantizamos operación ininterrumpida. El soporte se presta por canales definidos según el plan.",
          ],
        },
      ];
    default:
      return [];
  }
}

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export default async function LegalDocumentPage({ params }: LegalPageProps) {
  const { slug } = await params;
  if (!isLegalSlug(slug)) notFound();

  const doc = LEGAL_DOCUMENTS[slug];
  const sections = documentSections(slug);

  return (
    <div className="relative min-h-screen bg-white text-pragma-black antialiased">
      <LandingNav session={EMPTY_LANDING_SESSION} />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="text-sm font-medium text-pragma-electric hover:underline"
        >
          ← Volver al inicio
        </Link>
        <h1 className="font-heading mt-6 text-2xl font-bold tracking-tight md:text-3xl">
          {doc.title}
        </h1>
        <p className="mt-2 text-sm text-pragma-mid-gray">
          Versión {doc.version} · Actualizado mayo 2026
        </p>
        <p className="mt-4 rounded-lg border border-pragma-border bg-pragma-light-blue/30 px-4 py-3 text-sm text-foreground/85">
          {LEGAL_DISCLAIMER}
        </p>
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold text-foreground">{section.title}</h2>
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/80">
                {section.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
