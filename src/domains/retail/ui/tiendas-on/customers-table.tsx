"use client";

import { HandCoins } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createCustomerAction, registerCustomerPaymentAction } from "@/domains/retail/actions/retail.actions";
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
  alias: string | null;
  documentId: string | null;
  phone: string | null;
  creditBalance: number;
  lastPaymentAt: Date | string | null;
};

export function TiendasOnCustomersTable({ customers }: { customers: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.alias?.toLowerCase().includes(q) ?? false) ||
        (c.documentId?.toLowerCase().includes(q) ?? false) ||
        (c.phone?.toLowerCase().includes(q) ?? false),
    );
  }, [customers, query]);

  function submitNewCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await createCustomerAction(data);
        toast.success("Cliente creado.");
        setShowForm(false);
        event.currentTarget.reset();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo crear el cliente.");
      }
    });
  }

  return (
    <>
      <TiendasOnActionBar>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar Cliente"
          className="h-10 max-w-xl flex-1 rounded-md border border-[#c5ced8] bg-white px-3 text-sm outline-none focus:border-pragma-electric"
        />
        <TiendasOnPrimaryButton onClick={() => setShowForm((v) => !v)}>
          Nuevo Cliente
        </TiendasOnPrimaryButton>
      </TiendasOnActionBar>

      {showForm ? (
        <div className="mx-4 mb-4 rounded-md border border-[#d5dce6] bg-white p-4">
          <form onSubmit={submitNewCustomer} className="grid gap-3 md:grid-cols-2">
            <p className="md:col-span-2 text-sm font-semibold text-[#2d3748]">Nuevo cliente</p>
            <input name="name" required placeholder="Nombre completo" className="h-10 rounded border px-3 text-sm" />
            <input name="alias" placeholder="Alias" className="h-10 rounded border px-3 text-sm" />
            <input name="documentId" placeholder="Documento" className="h-10 rounded border px-3 text-sm" />
            <input name="phone" placeholder="Teléfono" className="h-10 rounded border px-3 text-sm" />
            <input name="creditLimit" type="number" min="0" placeholder="Cupo crédito" className="h-10 rounded border px-3 text-sm" />
            <div className="md:col-span-2">
              <TiendasOnPrimaryButton type="submit" className={pending ? "opacity-60" : ""}>
                Guardar cliente
              </TiendasOnPrimaryButton>
            </div>
          </form>
        </div>
      ) : null}

      <TiendasOnTable>
        <TiendasOnTableHead>
          <TiendasOnTh>Nombre</TiendasOnTh>
          <TiendasOnTh>Alias</TiendasOnTh>
          <TiendasOnTh>Documento</TiendasOnTh>
          <TiendasOnTh>Teléfono</TiendasOnTh>
          <TiendasOnTh>Saldo</TiendasOnTh>
          <TiendasOnTh>Último Pago</TiendasOnTh>
          <TiendasOnTh>Registrar Pago</TiendasOnTh>
        </TiendasOnTableHead>
        <tbody>
          {filtered.map((customer) => (
            <tr key={customer.id}>
              <TiendasOnTd className="font-medium uppercase">{customer.name}</TiendasOnTd>
              <TiendasOnTd>{customer.alias ?? "—"}</TiendasOnTd>
              <TiendasOnTd>{customer.documentId ?? "—"}</TiendasOnTd>
              <TiendasOnTd>{customer.phone ?? "—"}</TiendasOnTd>
              <TiendasOnTd>{formatIntiendasMoney(customer.creditBalance)}</TiendasOnTd>
              <TiendasOnTd>{formatIntiendasDate(customer.lastPaymentAt)}</TiendasOnTd>
              <TiendasOnTd>
                <form action={registerCustomerPaymentAction} className="inline-flex items-center gap-2">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input
                    name="amount"
                    type="number"
                    min="1"
                    placeholder="0"
                    className="h-8 w-20 rounded border border-[#c5ced8] px-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="inline-flex size-8 items-center justify-center text-pragma-electric"
                    title="Registrar pago"
                  >
                    <HandCoins className="size-5" />
                  </button>
                </form>
              </TiendasOnTd>
            </tr>
          ))}
        </tbody>
      </TiendasOnTable>
    </>
  );
}
