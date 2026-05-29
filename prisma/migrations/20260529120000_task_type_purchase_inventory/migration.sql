-- Compras e Inventario en el módulo de tareas operativas
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'PURCHASE';
ALTER TYPE "TaskType" ADD VALUE IF NOT EXISTS 'INVENTORY';
