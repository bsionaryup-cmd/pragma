import { requireRetailContext } from "@/domains/retail/auth/require-retail-context";

export default async function RetailAppLayout({ children }: { children: React.ReactNode }) {
  await requireRetailContext();
  return <div className="intiendas-tiendas-on min-h-dvh bg-[#f3f5f7]">{children}</div>;
}
