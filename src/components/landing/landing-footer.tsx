import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const footerLinks = [
  { href: "#features", label: "Funciones" },
  { href: "#product", label: "Producto" },
  { href: "/sign-in", label: "Iniciar sesión" },
  { href: "/sign-up", label: "Registrarse" },
];

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[#E9ECEF] bg-white py-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#111111]">
            {APP_NAME} PMS
          </p>
          <p className="mt-2 text-sm text-[#6B7280]">
            © {year} {APP_NAME}. Todos los derechos reservados.
          </p>
        </div>

        <ul className="flex flex-wrap gap-8">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-sm text-[#6B7280] transition-colors hover:text-[#111111]"
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
