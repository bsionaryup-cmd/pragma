import { redirect } from "next/navigation";

/** Legacy IA route — Pedidos is the intelligence center. */
export default function RetailAiRedirectPage() {
  redirect("/intiendas/pedidos");
}
