"use client";

import {
  Banknote,
  Coffee,
  Grid3X3,
  MapPin,
  Minus,
  Package,
  Pause,
  Plus,
  SlidersHorizontal,
  Star,
  User,
  X,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeSaleAction } from "@/domains/retail/actions/retail.actions";
import { suspendSaleAction } from "@/domains/retail/actions/sale.actions";
import type { SaleInput } from "@/domains/retail/types";
import { formatIntiendasMoney } from "@/domains/retail/ui/tiendas-on/format";
import { TiendasOnScreenHeader } from "@/domains/retail/ui/tiendas-on/screen-header";
import { TiendasOnScreenFooter } from "@/domains/retail/ui/tiendas-on/screen-footer";
import { cn } from "@/lib/utils";

type PosProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  isFavorite: boolean;
};
type PosCustomer = { id: string; name: string; creditBalance: number; documentId?: string | null };
type CartLine = PosProduct & { quantity: number };

const QUICK_CUSTOMER = { id: "", name: "Cliente Rápido", doc: "222222222222" };

export function TiendasOnPos({
  products,
  customers,
  cashSessionId,
  storeCode,
}: {
  products: PosProduct[];
  customers: PosCustomer[];
  cashSessionId?: string;
  storeCode?: string;
}) {
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      if (favoritesOnly && !product.isFavorite) return false;
      return !normalized || product.name.toLowerCase().includes(normalized);
    });
  }, [products, query, favoritesOnly]);

  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const total = Math.max(0, subtotal - discount + delivery);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  function addProduct(product: PosProduct) {
    if (product.stock <= 0) return toast.error("Producto sin existencias.");
    setCart((current) => {
      const found = current.find((line) => line.id === product.id);
      if (!found) return [...current, { ...product, quantity: 1 }];
      if (found.quantity >= product.stock) return current;
      return current.map((line) =>
        line.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
      );
    });
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
        });
        setCart([]);
        setDiscount(0);
        setDelivery(0);
        toast.success(`Venta ${sale.code} registrada.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo completar la venta.");
      }
    });
  }

  function suspend() {
    if (!cart.length) return toast.error("No hay productos en la venta.");
    startTransition(async () => {
      try {
        await suspendSaleAction({
          items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
          customerId: customerId || null,
          cashSessionId: cashSessionId || null,
          paymentMethod: "CASH",
          discount,
          deliveryFee: delivery,
        });
        setCart([]);
        toast.success("Venta temporal guardada.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo guardar la venta.");
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#eef1f4]">
      <TiendasOnScreenHeader
        title="Ventas"
        rightSlot={
          <>
            <MapPin className="size-5" />
            <Coffee className="size-5" />
            <Grid3X3 className="size-5" />
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,32%)_1fr_minmax(300px,30%)]">
        {/* Catálogo */}
        <section className="flex min-h-0 flex-col border-r border-[#d9dee5] bg-[#f8fafb]">
          <div className="flex items-center gap-2 border-b border-[#e2e8f0] p-3">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-md bg-pragma-electric text-white"
              aria-label="Filtros"
            >
              <SlidersHorizontal className="size-4" />
            </button>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className="h-9 flex-1 rounded-md border border-[#c5ced8] bg-white px-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={cn(
              "mx-3 mt-3 w-fit rounded-full border px-3 py-1 text-xs",
              favoritesOnly
                ? "border-pragma-electric bg-pragma-electric/10 text-pragma-electric"
                : "border-[#c5ced8] bg-white text-[#4a5568]",
            )}
          >
            Mis favoritos
          </button>
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-0 overflow-y-auto p-1 sm:grid-cols-3">
            {visible.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                disabled={product.stock <= 0 || pending}
                className="relative flex min-h-[150px] flex-col border border-[#e2e8f0] bg-white p-2 text-left transition hover:bg-[#f8fbff] disabled:opacity-50"
              >
                {product.isFavorite ? (
                  <Star className="absolute right-2 top-2 size-4 fill-amber-400 text-amber-400" />
                ) : null}
                <div className="mx-auto flex size-16 items-center justify-center rounded bg-[#f1f5f9] text-[#94a3b8]">
                  <Package className="size-8" />
                </div>
                <p className="mt-2 line-clamp-2 text-[11px] font-medium uppercase leading-tight text-[#2d3748]">
                  {product.name}
                </p>
                <p className="mt-1 text-sm font-bold text-[#2d3748]">
                  {formatIntiendasMoney(product.price)}
                </p>
                <span className="absolute bottom-2 right-2 flex size-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                  {product.stock}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Ticket */}
        <section className="min-h-[240px] overflow-y-auto bg-white p-3 lg:min-h-0">
          {cart.map((line) => (
            <div
              key={line.id}
              className="mb-3 flex items-start gap-3 border-b border-[#edf2f7] pb-3"
            >
              <div className="flex size-14 shrink-0 items-center justify-center rounded bg-[#f1f5f9]">
                <Package className="size-6 text-[#94a3b8]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium uppercase text-[#2d3748]">{line.name}</p>
                  <button
                    type="button"
                    onClick={() => changeQuantity(line.id, -line.quantity)}
                    className="text-[#94a3b8] hover:text-red-500"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-[#718096]">{formatIntiendasMoney(line.price)}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.id, -1)}
                      className="flex size-7 items-center justify-center rounded-full bg-red-500 text-white"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-6 text-center font-semibold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(line.id, 1)}
                      className="flex size-7 items-center justify-center rounded-full bg-red-500 text-white"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="text-sm font-semibold text-[#2d3748]">
                    {formatIntiendasMoney(line.price * line.quantity)}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {!cart.length ? (
            <p className="py-16 text-center text-sm text-[#94a3b8]">
              Selecciona productos del catálogo.
            </p>
          ) : null}
        </section>

        {/* Cliente y totales */}
        <section className="flex min-h-0 flex-col border-l border-[#d9dee5] bg-white">
          <div className="border-b border-[#edf2f7] p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded bg-pragma-electric text-white">
                <User className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold text-[#2d3748] outline-none"
                >
                  <option value="">{QUICK_CUSTOMER.name}</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[#718096]">
                  {selectedCustomer?.documentId ?? QUICK_CUSTOMER.doc}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#718096]">Descuento</span>
              <div className="flex items-center gap-2">
                <span>{formatIntiendasMoney(discount)}</span>
                <button
                  type="button"
                  onClick={() => {
                    const value = window.prompt("Descuento (COP)", String(discount));
                    if (value != null) setDiscount(Math.max(0, Number(value) || 0));
                  }}
                  className="flex size-6 items-center justify-center rounded bg-pragma-electric text-xs text-white"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#718096]">Subtotal</span>
              <span>{formatIntiendasMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#718096]">Domicilio</span>
              <div className="flex items-center gap-2">
                <span>{formatIntiendasMoney(delivery)}</span>
                <button
                  type="button"
                  onClick={() => {
                    const value = window.prompt("Domicilio (COP)", String(delivery));
                    if (value != null) setDelivery(Math.max(0, Number(value) || 0));
                  }}
                  className="flex size-6 items-center justify-center rounded bg-pragma-electric text-xs text-white"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#edf2f7] pt-3 text-base font-bold">
              <span>Total</span>
              <span>{formatIntiendasMoney(total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-0 bg-pragma-electric text-white">
            <button
              type="button"
              disabled={pending}
              onClick={() => setCart([])}
              className="flex flex-col items-center gap-1 border-r border-white/20 py-4 text-xs font-semibold hover:bg-pragma-electric/90"
            >
              <X className="size-5" />
              Limpiar venta
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => complete("CREDIT")}
              className="flex flex-col items-center gap-1 border-r border-white/20 py-4 text-xs font-semibold hover:bg-pragma-electric/90"
            >
              <Banknote className="size-5" />
              Pago a crédito
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => complete("CASH")}
              className="flex flex-col items-center gap-1 border-r border-white/20 py-4 text-xs font-semibold hover:bg-pragma-electric/90"
            >
              <Banknote className="size-5" />
              Pago de Contado
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={suspend}
              className="flex flex-col items-center gap-1 py-4 text-xs font-semibold hover:bg-pragma-electric/90"
            >
              <Pause className="size-5" />
              Venta temporal
            </button>
          </div>
        </section>
      </div>

      <TiendasOnScreenFooter storeCode={storeCode} />
    </div>
  );
}
