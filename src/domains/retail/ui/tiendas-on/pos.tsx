"use client";

import {
  Banknote,
  Clock3,
  FileText,
  House,
  Minus,
  Pause,
  Plus,
  Search,
  ShoppingBag,
  User,
  X,
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeSaleAction } from "@/domains/retail/actions/retail.actions";
import {
  claimSuspendedSaleAction,
  suspendSaleAction,
} from "@/domains/retail/actions/sale.actions";
import type { SaleInput } from "@/domains/retail/types";
import { formatIntiendasDateTime, formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnScreenHeader } from "@/domains/retail/ui/tiendas-on/screen-header";
import { TiendasOnScreenFooter } from "@/domains/retail/ui/tiendas-on/screen-footer";
import { cn } from "@/lib/utils";

type PosProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  sku: string | null;
  imageUrl?: string | null;
};
type PosCustomer = { id: string; name: string; creditBalance: number; documentId?: string | null };
type CartLine = PosProduct & { quantity: number };
type SuspendedSale = {
  id: string;
  code: string;
  customerId: string | null;
  customerName: string;
  discount: number;
  total: number;
  note: string | null;
  createdAt: Date | string;
  items: Array<{
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

const QUICK_CUSTOMER = { id: "", name: "Cliente Rápido", doc: "222222222222" };

export function TiendasOnPos({
  products,
  customers,
  suspendedSales: initialSuspended,
  cashSessionId,
  storeCode,
}: {
  products: PosProduct[];
  customers: PosCustomer[];
  suspendedSales: SuspendedSale[];
  cashSessionId?: string;
  storeCode?: string;
}) {
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [note, setNote] = useState("");
  const [showHeld, setShowHeld] = useState(false);
  const [held, setHeld] = useState(initialSuspended);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(normalized) ||
        product.barcode?.toLowerCase().includes(normalized) ||
        product.sku?.toLowerCase().includes(normalized),
    );
  }, [products, query]);

  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const total = Math.max(0, subtotal - discount + delivery);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  function addProduct(product: PosProduct, qty = 1) {
    if (product.stock <= 0) {
      toast.error("Producto sin existencias.");
      return false;
    }
    setCart((current) => {
      const found = current.find((line) => line.id === product.id);
      if (!found) {
        return [...current, { ...product, quantity: Math.min(qty, product.stock) }];
      }
      const nextQty = Math.min(product.stock, found.quantity + qty);
      if (nextQty === found.quantity) {
        toast.error("No hay más existencias de este producto.");
        return current;
      }
      return current.map((line) =>
        line.id === product.id ? { ...line, quantity: nextQty } : line,
      );
    });
    return true;
  }

  function findByCode(code: string) {
    const normalized = code.trim().toLowerCase();
    if (!normalized) return null;
    return (
      products.find((p) => p.barcode?.toLowerCase() === normalized) ||
      products.find((p) => p.sku?.toLowerCase() === normalized) ||
      null
    );
  }

  /** Lector láser (modo teclado): Enter dispara búsqueda exacta por código. */
  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = query.trim();
    if (!code) return;
    const product = findByCode(code);
    if (!product) {
      toast.error("Código no encontrado.");
      return;
    }
    if (addProduct(product)) {
      setQuery("");
      searchRef.current?.select();
    }
  }

  function changeQuantity(id: string, delta: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === id
            ? { ...line, quantity: Math.min(line.stock, line.quantity + delta) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  function resetTicket() {
    setCart([]);
    setDiscount(0);
    setDelivery(0);
    setNote("");
    setCustomerId("");
  }

  function complete(paymentMethod: SaleInput["paymentMethod"]) {
    if (!cart.length) return toast.error("Agrega productos a la venta.");
    if (paymentMethod === "CREDIT" && !customerId) {
      return toast.error("Selecciona un cliente para crédito.");
    }
    startTransition(async () => {
      try {
        const sale = await completeSaleAction({
          items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
          customerId: customerId || null,
          cashSessionId: cashSessionId || null,
          paymentMethod,
          discount,
          deliveryFee: delivery,
          amountPaid: paymentMethod === "CREDIT" ? 0 : total,
          note: note || null,
        });
        resetTicket();
        toast.success(`Venta ${sale.code} registrada.`);
        searchRef.current?.focus();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo completar la venta.");
      }
    });
  }

  function suspend() {
    if (!cart.length) return toast.error("No hay productos en la venta.");
    startTransition(async () => {
      try {
        const sale = await suspendSaleAction({
          items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
          customerId: customerId || null,
          cashSessionId: cashSessionId || null,
          paymentMethod: "CASH",
          discount,
          deliveryFee: delivery,
          note: note || null,
        });
        setHeld((current) => [
          {
            id: sale.id,
            code: sale.code,
            customerId: customerId || null,
            customerName: selectedCustomer?.name ?? QUICK_CUSTOMER.name,
            discount,
            total,
            note: note || null,
            createdAt: new Date().toISOString(),
            items: cart.map((line) => ({
              productId: line.id,
              productName: line.name,
              quantity: line.quantity,
              unitPrice: line.price,
              lineTotal: line.price * line.quantity,
            })),
          },
          ...current,
        ]);
        resetTicket();
        toast.success("Venta guardada en espera.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la venta.");
      }
    });
  }

  function restoreHeld(saleId: string) {
    if (cart.length && !window.confirm("Hay una venta en curso. ¿Reemplazarla con la venta en espera?")) {
      return;
    }
    startTransition(async () => {
      try {
        const claimed = await claimSuspendedSaleAction(saleId);
        const nextCart: CartLine[] = [];
        for (const item of claimed.items) {
          const product = products.find((p) => p.id === item.productId);
          if (!product) continue;
          nextCart.push({
            ...product,
            quantity: Math.min(product.stock || item.quantity, item.quantity),
            price: item.unitPrice || product.price,
          });
        }
        if (!nextCart.length) {
          toast.error("No se pudieron restaurar los productos.");
          return;
        }
        setCart(nextCart);
        setCustomerId(claimed.customerId ?? "");
        setDiscount(claimed.discount);
        setNote(claimed.note ?? "");
        setDelivery(0);
        setHeld((current) => current.filter((s) => s.id !== saleId));
        setShowHeld(false);
        toast.success(`Venta ${claimed.code} restaurada.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo restaurar la venta.");
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#eef1f4]">
      <TiendasOnScreenHeader
        title="Ventas"
        className="h-16 [&_span]:text-2xl [&_span]:font-semibold"
        rightSlot={
          <div className="flex items-center gap-4 text-[#6b7c8f]">
            <button
              type="button"
              onClick={() => setShowHeld((v) => !v)}
              className="relative inline-flex items-center gap-2 rounded-md border border-[#c5ced8] bg-white px-3 py-2 text-sm font-semibold text-[#2d3748] hover:border-pragma-electric hover:text-pragma-electric"
            >
              <Clock3 className="size-5" />
              Ventas en espera
              {held.length ? (
                <span className="rounded-full bg-pragma-electric px-2 py-0.5 text-xs text-white">
                  {held.length}
                </span>
              ) : null}
            </button>
            <a href="/intiendas/dashboard" aria-label="Inicio" className="hover:text-pragma-electric">
              <House className="size-6" strokeWidth={1.75} />
            </a>
          </div>
        }
      />

      {showHeld ? (
        <div className="border-b border-[#d9dee5] bg-white px-4 py-3">
          <p className="mb-2 text-base font-semibold text-[#2d3748]">Ventas en espera</p>
          {held.length ? (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {held.map((sale) => (
                <button
                  key={sale.id}
                  type="button"
                  disabled={pending}
                  onClick={() => restoreHeld(sale.id)}
                  className="rounded-md border border-[#d5dce6] bg-[#f8fafc] p-3 text-left transition hover:border-pragma-electric"
                >
                  <p className="font-semibold text-[#2d3748]">{sale.code}</p>
                  <p className="text-sm text-[#718096]">
                    {sale.customerName} · {sale.items.length} productos ·{" "}
                    {formatIntiendasMoney(sale.total)}
                  </p>
                  <p className="text-xs text-[#94a3b8]">{formatIntiendasDateTime(sale.createdAt)}</p>
                  <p className="mt-2 text-sm font-medium text-pragma-electric">Tocar para restaurar</p>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-base text-[#718096]">No hay ventas en espera.</p>
          )}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(300px,34%)_minmax(280px,1fr)_minmax(300px,28%)]">
        <section className="flex min-h-0 flex-col border-r border-[#d9dee5] bg-[#f4f6f8]">
          <div className="space-y-2 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[#94a3b8]" />
              <input
                ref={searchRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Buscar o escanear código"
                className="h-12 w-full rounded-lg border border-[#c5ced8] bg-white pl-11 pr-3 text-lg text-[#2d3748] outline-none focus:border-pragma-electric focus:ring-1 focus:ring-pragma-electric/30"
              />
            </div>
            <p className="text-xs text-[#718096]">
              El lector láser agrega el producto al presionar Enter.
            </p>
          </div>

          <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-0 overflow-y-auto sm:grid-cols-3">
            {visible.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                disabled={product.stock <= 0 || pending}
                className="relative flex min-h-[168px] flex-col border border-[#e2e8f0] bg-[#eceff2] p-3 text-left transition hover:bg-[#e4e9ef] disabled:opacity-50"
              >
                <div className="mx-auto flex size-16 items-center justify-center text-[#8a9aab]">
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={product.imageUrl} alt="" className="size-16 rounded object-cover" />
                  ) : (
                    <ShoppingBag className="size-12" strokeWidth={1.25} />
                  )}
                </div>
                <p className="mt-3 line-clamp-2 text-[15px] font-semibold uppercase leading-snug text-[#2d3748]">
                  {product.name}
                </p>
                <p className="mt-auto pt-2 text-lg font-bold text-[#2d3748]">
                  {formatIntiendasMoney(product.price)}
                </p>
              </button>
            ))}
            {!visible.length ? (
              <p className="col-span-full py-16 text-center text-lg text-[#94a3b8]">
                Sin productos para mostrar.
              </p>
            ) : null}
          </div>
        </section>

        <section className="min-h-[240px] overflow-y-auto bg-white px-3 py-2 lg:min-h-0">
          {cart.map((line) => (
            <div
              key={line.id}
              className="relative mb-2 flex items-start gap-3 border-b border-[#edf2f7] py-4"
            >
              <div className="flex size-16 shrink-0 items-center justify-center rounded-md bg-[#f1f5f9]">
                <ShoppingBag className="size-8 text-[#94a3b8]" strokeWidth={1.35} />
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <p className="text-[15px] font-semibold uppercase leading-snug text-[#2d3748]">
                  {line.name}
                </p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-base text-[#718096]">
                    {formatIntiendasMoney(line.price)}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.id, -1)}
                      className="flex size-9 items-center justify-center rounded-full bg-[#e53935] text-white shadow-sm"
                      aria-label="Restar"
                    >
                      <Minus className="size-5" strokeWidth={2.5} />
                    </button>
                    <span className="min-w-6 text-center text-xl font-bold text-[#2d3748]">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.id, 1)}
                      className="flex size-9 items-center justify-center rounded-full bg-[#e53935] text-white shadow-sm"
                      aria-label="Sumar"
                    >
                      <Plus className="size-5" strokeWidth={2.5} />
                    </button>
                  </div>
                  <span className="text-base font-bold text-[#2d3748]">
                    {formatIntiendasMoney(line.price * line.quantity)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => changeQuantity(line.id, -line.quantity)}
                className="absolute right-0 top-3 text-[#94a3b8] hover:text-red-500"
                aria-label="Quitar"
              >
                <X className="size-5" />
              </button>
            </div>
          ))}
          {!cart.length ? (
            <p className="py-20 text-center text-lg text-[#94a3b8]">
              Escanea o selecciona productos del catálogo.
            </p>
          ) : null}
        </section>

        <section className="flex min-h-0 flex-col border-l border-[#d9dee5] bg-white">
          <div className="border-b border-[#edf2f7] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-pragma-electric text-white">
                <User className="size-7" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-transparent text-lg font-bold text-[#2d3748] outline-none"
                >
                  <option value="">{QUICK_CUSTOMER.name}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <p className="text-base text-[#718096]">
                  {selectedCustomer?.documentId ?? QUICK_CUSTOMER.doc}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 p-4 text-lg">
            <div className="flex items-center justify-between">
              <span className="text-[#718096]">Descuento</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#2d3748]">{formatIntiendasMoney(discount)}</span>
                <button
                  type="button"
                  onClick={() => {
                    const value = window.prompt("Descuento (COP)", String(discount));
                    if (value != null) setDiscount(Math.max(0, Number(value) || 0));
                  }}
                  className="flex size-7 items-center justify-center rounded bg-pragma-electric text-base font-bold text-white"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#718096]">Subtotal</span>
              <span className="font-medium text-[#2d3748]">{formatIntiendasMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#718096]">Domicilio</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-[#2d3748]">{formatIntiendasMoney(delivery)}</span>
                <button
                  type="button"
                  onClick={() => {
                    const value = window.prompt("Domicilio (COP)", String(delivery));
                    if (value != null) setDelivery(Math.max(0, Number(value) || 0));
                  }}
                  className="flex size-7 items-center justify-center rounded bg-pragma-electric text-base font-bold text-white"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#edf2f7] pt-4 text-2xl font-bold text-[#2d3748]">
              <span>Total</span>
              <span>{formatIntiendasMoney(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-0">
            <button
              type="button"
              disabled={pending}
              onClick={resetTicket}
              className="flex min-h-[78px] flex-col items-center justify-center gap-1 border-r border-t border-[#d9dee5] bg-[#f8fafc] px-2 py-3 text-[14px] font-semibold text-[#4a5568] hover:bg-[#eef2f7] disabled:opacity-60"
            >
              <X className="size-5" strokeWidth={2.25} />
              Limpiar venta
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => complete("CREDIT")}
              className="flex min-h-[78px] flex-col items-center justify-center gap-1 border-t border-[#d9dee5] bg-[#f8fafc] px-2 py-3 text-[14px] font-semibold text-[#4a5568] hover:bg-[#eef2f7] disabled:opacity-60"
            >
              <FileText className="size-5" strokeWidth={1.75} />
              Pago a crédito
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={() => complete("CASH")}
              className={cn(
                "col-span-2 flex min-h-[100px] flex-col items-center justify-center gap-1.5 bg-pragma-electric px-3 py-4 text-xl font-bold text-white shadow-[0_0_0_4px_rgba(20,228,200,0.35)] transition hover:bg-pragma-electric/90 disabled:opacity-60",
              )}
            >
              <Banknote className="size-7" strokeWidth={1.75} />
              Pago de Contado
            </button>

            <button
              type="button"
              disabled={pending}
              onClick={suspend}
              className="col-span-2 flex min-h-[72px] items-center justify-center gap-2 border-t border-[#d9dee5] bg-[#1e3a5f] px-2 py-3 text-[15px] font-semibold text-white hover:bg-[#254a73] disabled:opacity-60"
            >
              <Pause className="size-5" strokeWidth={1.75} />
              Guardar venta temporal
            </button>
          </div>
        </section>
      </div>

      <TiendasOnScreenFooter storeCode={storeCode} />
    </div>
  );
}
