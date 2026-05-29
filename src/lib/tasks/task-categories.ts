import type { TaskType } from "@prisma/client";

export const TASK_CATEGORY_SLUGS = [
  "compras",
  "mantenimiento",
  "limpieza",
  "inventario",
] as const;

export type TaskCategorySlug = (typeof TASK_CATEGORY_SLUGS)[number];

export type TaskCategoryConfig = {
  slug: TaskCategorySlug;
  title: string;
  description: string;
  taskType: TaskType | null;
  comingSoon?: boolean;
};

export const TASK_CATEGORIES: Record<TaskCategorySlug, TaskCategoryConfig> = {
  compras: {
    slug: "compras",
    title: "Compras",
    description: "Control de compras para tus alojamientos",
    taskType: null,
    comingSoon: true,
  },
  mantenimiento: {
    slug: "mantenimiento",
    title: "Mantenimientos",
    description: "Tareas de mantenimiento por propiedad",
    taskType: "MAINTENANCE",
  },
  limpieza: {
    slug: "limpieza",
    title: "Limpieza",
    description: "Turnos y tareas de limpieza",
    taskType: "CLEANING",
  },
  inventario: {
    slug: "inventario",
    title: "Inventario",
    description: "Stock y suministros de tus alojamientos",
    taskType: null,
    comingSoon: true,
  },
};

export const DEFAULT_TASK_CATEGORY: TaskCategorySlug = "compras";

export function isTaskCategorySlug(value: string): value is TaskCategorySlug {
  return TASK_CATEGORY_SLUGS.includes(value as TaskCategorySlug);
}

export function getTaskCategoryConfig(
  slug: string,
): TaskCategoryConfig | null {
  if (!isTaskCategorySlug(slug)) return null;
  return TASK_CATEGORIES[slug];
}
