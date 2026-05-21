import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { BRAND } from "@/lib/brand";

const footerLinks = [
  { href: "#solution", label: "Solución" },
  { href: "#product", label: "Command Center" },
  { href: "#integrations", label: "Integraciones" },
  { href: "/sign-in", label: "Iniciar sesión" },
  { href: "/sign-up", label: "Solicitar demo" },
];

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-pragma-border bg-white py-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-accent text-sm font-bold text-pragma-black">{APP_NAME}</p>
            <p className="mt-2 text-sm leading-relaxed text-pragma-mid-gray">
              {BRAND.tagline} Software para gestión y automatización de Airbnb.
            </p>
            <p className="mt-4 text-xs text-pragma-mid-gray">
              © {year} {APP_NAME}. Todos los derechos reservados.
            </p>
          </div>

          <nav aria-label="Pie de página">
            <ul className="flex flex-wrap gap-x-8 gap-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-pragma-mid-gray transition-colors hover:text-pragma-electric"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
