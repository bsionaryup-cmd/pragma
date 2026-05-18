"use client";

import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTaskStatusAction } from "@/features/tasks/actions/task.actions";
import { TaskStatus } from "@prisma/client";
import { taskStatusLabels } from "@/lib/labels";

export function TaskStatusSelect({
  taskId,
  current,
}: {
  taskId: string;
  current: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Select
      disabled={pending}
      value={current}
      onValueChange={(v) =>
        startTransition(() =>
          updateTaskStatusAction(taskId, v as TaskStatus),
        )
      }
    >
      <SelectTrigger className="h-8 w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.values(TaskStatus).map((s) => (
          <SelectItem key={s} value={s}>
            {taskStatusLabels[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
