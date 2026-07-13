"use client";

import { Pencil, Trash2, HandCoins } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createCustomerAction,
  deleteCustomerAction,
  registerCustomerPaymentAction,
  updateCustomerAction,
} from "@/domains/retail/actions/retail.actions";
import { formatIntiendasDate, formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import {
  TiendasOnTable,
  TiendasOnTableHead,
  TiendasOnTd,
  TiendasOnTh,
} from "@/domains/retail/ui/tiendas-on/data-display";
import {
  TiendasOnActionBar,
  TiendasOnPrimaryButton,
} from "@/domains/retail/ui/tiendas-on/controls";

type CustomerRow = {
  id: string;
  name: string;
  documentId: string | null;
  phone: string | null;
  creditBalance: number;
  creditLimit: number;
  lastPaymentAt: Date | string | null;
};

export function TiendasOnCustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.documentId?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false),
    );
  }, [customers, query]);

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        if (editing) {
          await updateCustomerAction(data);
          toast.success("Cliente actualizado.");
        } else {
          await createCustomerAction(data);
          toast.success("Cliente creado.");
        }
        setShowForm(false);
        setEditing(null);
        event.currentTarget.reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
      }
    });
  }

  function removeCustomer(id: string, name: string) {
    if (!window.confirm(`¿Eliminar a ${name}?`)) return;
    const data = new FormData();
    data.set("id", id);
    startTransition(async () => {
      try {
        await deleteCustomerAction(data);
        toast.success("Cliente eliminado.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo eliminar.");
      }
    });
  }

  return (
    <>
      <TiendasOnActionBar>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar cliente"
          className="h-11 max-w-xl flex-1 rounded-md border border-[#c5ced8] bg-white px-3 text-base outline-none focus:border-pragma-electric"
        />
        <TiendasOnPrimaryButton
          onClick={() => {
            setEditing(null);
            setShowForm((v) => !v);
          }}
          className="text-base"
        >
          Nuevo Cliente
        </TiendasOnPrimaryButton>
      </TiendasOnActionBar>

      {showForm || editing ? (
        <div className="mx-4 mb-4 rounded-md border border-[#d5dce6] bg-white p-4">
          <form onSubmit={submitForm} className="grid gap-3 md:grid-cols-2">
            <p className="md:col-span-2 text-base font-semibold text-[#2d3748]">
              {editing ? "Editar cliente" : "Nuevo cliente"}
            </p>
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <input
              name="name"
              required
              defaultValue={editing?.name}
              placeholder="Nombre completo"
              className="h-11 rounded border px-3 text-base"
            />
            <input
              name="documentId"
              defaultValue={editing?.documentId ?? ""}
              placeholder="Documento"
              className="h-11 rounded border px-3 text-base"
            />
            <input
              name="phone"
              defaultValue={editing?.phone ?? ""}
              placeholder="Teléfono"
              className="h-11 rounded border px-3 text-base"
            />
            <input
              name="creditLimit"
              type="number"
              min="0"
              defaultValue={editing?.creditLimit ?? ""}
              placeholder="Cupo crédito"
              className="h-11 rounded border px-3 text-base"
            />
            <div className="md:col-span-2 flex gap-2">
              <TiendasOnPrimaryButton type="submit" className={pending ? "opacity-60" : ""}>
                Guardar
              </TiendasOnPrimaryButton>
              <button
                type="button"
                className="text-base text-[#718096]"
                onClick={() => {
                  setShowForm(false);
                  setEditing(null);
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <TiendasOnTable>
        <TiendasOnTableHead>
          <TiendasOnTh className="text-base">Nombre</TiendasOnTh>
          <TiendasOnTh className="text-base">Documento</TiendasOnTh>
          <TiendasOnTh className="text-base">Teléfono</TiendasOnTh>
          <TiendasOnTh className="text-base">Saldo</TiendasOnTh>
          <TiendasOnTh className="text-base">Último Pago</TiendasOnTh>
          <TiendasOnTh className="text-base">Pago</TiendasOnTh>
          <TiendasOnTh className="text-base">Acciones</TiendasOnTh>
        </TiendasOnTableHead>
        <tbody>
          {filtered.map((customer) => (
            <tr key={customer.id}>
              <TiendasOnTd className="text-base font-medium uppercase">{customer.name}</TiendasOnTd>
              <TiendasOnTd className="text-base">{customer.documentId ?? "—"}</TiendasOnTd>
              <TiendasOnTd className="text-base">{customer.phone ?? "—"}</TiendasOnTd>
              <TiendasOnTd className="text-base">{formatIntiendasMoney(customer.creditBalance)}</TiendasOnTd>
              <TiendasOnTd className="text-base">{formatIntiendasDate(customer.lastPaymentAt)}</TiendasOnTd>
              <TiendasOnTd>
                <form action={registerCustomerPaymentAction} className="inline-flex items-center gap-2">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    placeholder="0"
                    className="h-9 w-24 rounded border border-[#c5ced8] px-2 text-base"
                  />
                  <button
                    type="submit"
                    className="inline-flex size-9 items-center justify-center text-pragma-electric"
                    title="Registrar pago"
                  >
                    <HandCoins className="size-5" />
                  </button>
                </form>
              </TiendasOnTd>
              <TiendasOnTd>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-pragma-electric"
                    onClick={() => {
                      setEditing(customer);
                      setShowForm(true);
                    }}
                    title="Editar"
                  >
                    <Pencil className="size-5" />
                  </button>
                  <button
                    type="button"
                    className="text-red-500"
                    onClick={() => removeCustomer(customer.id, customer.name)}
                    title="Eliminar"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              </TiendasOnTd>
            </tr>
          ))}
        </tbody>
      </TiendasOnTable>
    </>
  );
}
