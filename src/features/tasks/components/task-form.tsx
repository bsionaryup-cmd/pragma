"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTaskAction, updateTaskAction } from "@/features/tasks/actions/task.actions";
import {
  taskFormSchema,
  type TaskFormValues,
} from "@/features/tasks/schemas/task.schema";

type TaskFormProps = {
  taskId?: string;
  defaultValues?: TaskFormValues;
};

export function TaskForm({ taskId, defaultValues }: TaskFormProps = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(taskId);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: defaultValues ?? {
      title: "",
      description: "",
    },
  });

  function onSubmit(values: TaskFormValues) {
    startTransition(async () => {
      try {
        if (isEdit && taskId) {
          await updateTaskAction(taskId, values);
          toast.success("Tarea actualizada");
        } else {
          await createTaskAction(values);
          toast.success("Tarea creada");
        }
        router.push("/tasks");
      } catch {
        toast.error(isEdit ? "No se pudo actualizar la tarea" : "No se pudo crear la tarea");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-xl space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ej. Comprar detergente" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={4}
                  placeholder="Detalle libre: qué hacer, dónde, observaciones…"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear tarea"}
        </Button>
      </form>
    </Form>
  );
}
