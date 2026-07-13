import {
  BarChart3,
  Bot,
  Boxes,
  LayoutDashboard,
  PackageCheck,
  Settings,
  ShoppingBasket,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";

export const RETAIL_NAV = [
  { label: "Dashboard", href: "/intiendas/dashboard", icon: LayoutDashboard },
  { label: "Ventas", href: "/intiendas/ventas", icon: ShoppingCart },
  { label: "Inventario", href: "/intiendas/inventario", icon: Boxes },
  { label: "Proveedores", href: "/intiendas/proveedores", icon: Truck },
  { label: "Compras", href: "/intiendas/compras", icon: ShoppingBasket },
  { label: "Clientes", href: "/intiendas/clientes", icon: Users },
  { label: "Reportes", href: "/intiendas/reportes", icon: BarChart3 },
  { label: "IA", href: "/intiendas/ia", icon: Bot },
  { label: "Configuración", href: "/intiendas/configuracion", icon: Settings },
] as const;

export const RETAIL_QUICK_ACTIONS = [
  { label: "Nueva venta", href: "/intiendas/ventas", icon: ShoppingCart },
  { label: "Recibir compra", href: "/intiendas/compras", icon: PackageCheck },
] as const;
