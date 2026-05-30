import { redirect } from "next/navigation";

type TasksCategoryPageProps = {
  params: Promise<{ category: string }>;
};

/** Rutas antiguas (/tasks/compras, etc.) → módulo unificado. */
export default async function TasksCategoryPage(_props: TasksCategoryPageProps) {
  redirect("/tasks");
}
