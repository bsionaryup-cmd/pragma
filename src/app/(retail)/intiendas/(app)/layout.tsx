import { redirect } from "next/navigation";

/** INTIENDAS POS retired — keep route tree for now but send users to PMS. */
export default async function RetailAppLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  redirect("/panel");
}
