"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTaskAction } from "@/features/tasks/actions/task.actions";
import { Button } from "@/components/ui/button";

type TaskItemActionsProps = {
  taskId: string;
  taskTitle: string;
};

export function TaskItemActions({ taskId, taskTitle }: TaskItemActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    const ok = window.confirm(`¿Eliminar la tarea "${taskTitle}"?`);
    if (!ok) return;

    startTransition(async () => {
      try {
        await deleteTaskAction(taskId);
        toast.success("Tarea eliminada");
        router.refresh();
      } catch {
        toast.error("No se pudo eliminar la tarea");
      }
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        asChild
      >
        <Link href={`/tasks/${taskId}/edit`} aria-label="Editar tarea">
          <Pencil className="h-3.5 w-3.5" />
        </Link>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-danger"
        disabled={pending}
        onClick={handleDelete}
        aria-label="Eliminar tarea"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
