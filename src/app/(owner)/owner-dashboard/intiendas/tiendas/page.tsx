import { redirect } from "next/navigation";

/** Sección ocultada del admin INTIENDAS (solo Dashboard + Usuarios). */
export default function HiddenRetailAdminPage() {
  redirect("/owner-dashboard/intiendas");
}
