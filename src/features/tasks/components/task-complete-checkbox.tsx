"use client";

import { useTransition } from "react";
import { TaskStatus } from "@prisma/client";
import { toggleTaskCompletedAction } from "@/features/tasks/actions/task.actions";
import { cn } from "@/lib/utils";

export function TaskCompleteCheckbox({
  taskId,
  status,
  disabled = false,
}: {
  taskId: string;
  status: TaskStatus;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const completed = status === TaskStatus.COMPLETED;

  return (
    <input
      type="checkbox"
      checked={completed}
      disabled={disabled || pending}
      aria-label={completed ? "Marcar como pendiente" : "Marcar como completada"}
      className={cn(
        "h-4 w-4 shrink-0 rounded border-border accent-pragma-electric",
        pending && "opacity-50",
      )}
      onChange={(event) => {
        const next = event.target.checked;
        startTransition(() => toggleTaskCompletedAction(taskId, next));
      }}
    />
  );
}
