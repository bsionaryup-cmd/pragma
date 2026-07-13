import {
  BarChart3,
  FileText,
  LineChart,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";

export const INTIENDAS_MODULES = [
  { id: "ventas", label: "Ventas", href: "/intiendas/ventas", icon: ShoppingCart },
  { id: "compras", label: "Compras", href: "/intiendas/compras", icon: ShoppingBag },
  { id: "clientes", label: "Clientes", href: "/intiendas/clientes", icon: Users },
  { id: "caja", label: "Resumen de caja", href: "/intiendas/caja", icon: Wallet },
  { id: "movimientos", label: "Movimientos", href: "/intiendas/movimientos", icon: LineChart },
  { id: "productos", label: "Productos", href: "/intiendas/inventario", icon: Package },
  { id: "estadisticas", label: "Estadísticos", href: "/intiendas/estadisticas", icon: BarChart3 },
  { id: "informes", label: "Informes", href: "/intiendas/reportes", icon: FileText },
  { id: "configuracion", label: "Configuración", href: "/intiendas/configuracion", icon: Settings },
] as const;

export const INTIENDAS_VERSION = "1.0.0";
