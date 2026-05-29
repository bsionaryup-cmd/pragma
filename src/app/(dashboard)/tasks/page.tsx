import { redirect } from "next/navigation";
import { DEFAULT_TASK_CATEGORY } from "@/lib/tasks/task-categories";

export default function TasksPage() {
  redirect(`/tasks/${DEFAULT_TASK_CATEGORY}`);
}
