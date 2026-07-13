"use client";

import { Barcode, Minus, Pause, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { completeSaleAction } from "@/domains/retail/actions/retail.actions";
import { suspendSaleAction } from "@/domains/retail/actions/sale.actions";
import type { SaleInput } from "@/domains/retail/types";
import { formatRetailMoney } from "@/domains/retail/ui/retail-page";

type PosProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  barcode: string | null;
  isFavorite: boolean;
};
type PosCustomer = { id: string; name: string; creditBalance: number };
type CartLine = PosProduct & { quantity: number };

const PAYMENT_METHODS = [
  ["CASH", "Efectivo"],
  ["TRANSFER", "Transferencia"],
  ["QR", "QR"],
  ["CARD", "Tarjeta"],
  ["CREDIT", "Crédito"],
] as const;

export function PosClient({
  products,
  customers,
  cashSessionId,
}: {
  products: PosProduct[];
  customers: PosCustomer[];
  cashSessionId?: string;
}) {
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<NonNullable<SaleInput["paymentMethod"]>>("CASH");
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products
      .filter((product) => !normalized || product.name.toLowerCase().includes(normalized))
      .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));
  }, [products, query]);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

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

  function scanBarcode(event: React.FormEvent) {
    event.preventDefault();
    const found = products.find((product) => product.barcode === barcode.trim());
    if (!found) toast.error("No encontramos ese código de barras.");
    else addProduct(found);
    setBarcode("");
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

  function complete() {
    if (!cart.length) return toast.error("El carrito está vacío.");
    if (paymentMethod === "CREDIT" && !customerId) {
      return toast.error("Selecciona un cliente para vender a crédito.");
    }
    startTransition(async () => {
      try {
        const sale = await completeSaleAction({
          items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
          customerId: customerId || null,
          cashSessionId: cashSessionId || null,
          paymentMethod,
          amountPaid: paymentMethod === "CREDIT" ? 0 : total,
        });
        setCart([]);
        toast.success(`Venta ${sale.code} completada.`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo completar la venta.");
      }
    });
  }

  function suspend() {
    if (!cart.length) return toast.error("El carrito está vacío.");
    startTransition(async () => {
      try {
        await suspendSaleAction({
          items: cart.map((line) => ({ productId: line.id, quantity: line.quantity })),
          customerId: customerId || null,
          cashSessionId: cashSessionId || null,
          paymentMethod,
        });
        setCart([]);
        toast.success("Venta suspendida para continuar después.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo suspender la venta.");
      }
    });
  }

  return (
    <div className="grid min-h-[650px] gap-5 xl:grid-cols-[1fr_390px]">
      <section className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder="Buscar producto…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <form onSubmit={scanBarcode} className="relative">
            <Barcode className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder="Escanear código"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </form>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-4">
          {visible.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              disabled={product.stock <= 0}
              className={cn(
                "min-h-28 rounded-xl border bg-card p-4 text-left shadow-sm transition hover:border-pragma-cyan hover:shadow-pragma-soft",
                product.stock <= 0 && "cursor-not-allowed opacity-50",
              )}
            >
              <p className="line-clamp-2 font-semibold">{product.name}</p>
              <p className="mt-3 text-lg font-bold text-pragma-electric">
                {formatRetailMoney(product.price)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Stock: {product.stock}</p>
            </button>
          ))}
          {!visible.length ? (
            <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No hay productos que coincidan.
            </p>
          ) : null}
        </div>
      </section>

      <Card className="sticky top-20 h-fit gap-4 py-5 shadow-pragma-card">
        <div className="flex items-center gap-2 px-5">
          <ShoppingCart className="size-5 text-pragma-electric" />
          <h2 className="font-semibold">Venta actual</h2>
          <span className="ml-auto text-sm text-muted-foreground">{cart.length} productos</span>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto px-5">
          {cart.map((line) => (
            <div key={line.id} className="flex items-center gap-3 rounded-lg bg-pragma-soft-gray p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{line.name}</p>
                <p className="text-xs text-muted-foreground">{formatRetailMoney(line.price)}</p>
              </div>
              <Button size="icon-xs" variant="ghost" onClick={() => changeQuantity(line.id, -1)}>
                <Minus />
              </Button>
              <span className="w-5 text-center text-sm font-semibold">{line.quantity}</span>
              <Button size="icon-xs" variant="ghost" onClick={() => changeQuantity(line.id, 1)}>
                <Plus />
              </Button>
            </div>
          ))}
          {!cart.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Selecciona productos para iniciar.
            </p>
          ) : null}
        </div>
        <div className="space-y-4 border-t px-5 pt-4">
          <div>
            <Label htmlFor="pos-customer">Cliente</Label>
            <select
              id="pos-customer"
              className="mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
            >
              <option value="">Consumidor final</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Medio de pago</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={paymentMethod === value ? "brand" : "outline"}
                  onClick={() => setPaymentMethod(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-end justify-between border-t pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <strong className="text-3xl tracking-tight">{formatRetailMoney(total)}</strong>
          </div>
          <Button className="h-12 w-full" variant="brand" disabled={pending} onClick={complete}>
            {pending ? "Procesando…" : "Completar venta"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={pending} onClick={suspend}>
              <Pause /> Suspender
            </Button>
            <Button variant="ghost" onClick={() => setCart([])}>
              <Trash2 /> Cancelar
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
