import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const footerLinks = [
  { href: "#features", label: "Funciones" },
  { href: "#airbnb", label: "Airbnb" },
  { href: "#inbox", label: "Bandeja" },
  { href: "/sign-in", label: "Iniciar sesión" },
  { href: "/sign-up", label: "Registrarse" },
];

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-50">
            {APP_NAME} PMS
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            © {year} {APP_NAME}. Todos los derechos reservados.
          </p>
        </div>

        <ul className="flex flex-wrap gap-6">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
