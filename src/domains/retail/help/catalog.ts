/**
 * INTIENDAS Help Center — Single Source of Truth.
 * Articles document ONLY audited real screens/flows (no future features).
 */

export const HELP_MANUAL_VERSION = "1.3.0";

export type HelpCategoryId =
  | "primeros-pasos"
  | "dashboard"
  | "productos"
  | "inventario"
  | "ventas"
  | "compras"
  | "abastecimiento"
  | "clientes"
  | "caja"
  | "reportes"
  | "configuracion"
  | "seguridad"
  | "usuarios"
  | "faq"
  | "soporte"
  | "historial";

export type HelpArticle = {
  slug: string;
  title: string;
  categoryId: HelpCategoryId;
  href?: string;
  keywords: string[];
  objective: string;
  purpose: string;
  whenToUse: string;
  overview: string;
  steps: string[];
  buttons: Array<{ name: string; meaning: string }>;
  fields: Array<{ name: string; meaning: string }>;
  example: string;
  tips: string[];
  warnings: string[];
  commonErrors: string[];
  relatedSlugs: string[];
  /** Numbered callouts mirroring the real screen layout */
  callouts: Array<{ n: number; label: string; detail: string }>;
};

export type HelpCategory = {
  id: HelpCategoryId;
  title: string;
  description: string;
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "primeros-pasos",
    title: "Primeros pasos",
    description: "Cómo entrar y moverte por INTIENDAS.",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Menú principal de módulos.",
  },
  {
    id: "ventas",
    title: "Ventas",
    description: "Punto de venta y cobros.",
  },
  {
    id: "compras",
    title: "Compras",
    description: "Registro histórico de compras y gastos.",
  },
  {
    id: "abastecimiento",
    title: "Centro de Abastecimiento",
    description: "Sugerencias de pedidos a proveedores.",
  },
  {
    id: "productos",
    title: "Productos",
    description: "Catálogo y hub de productos.",
  },
  {
    id: "inventario",
    title: "Inventario",
    description: "Ajustes, devoluciones y traslados.",
  },
  {
    id: "clientes",
    title: "Clientes",
    description: "Clientes y fiados.",
  },
  {
    id: "caja",
    title: "Caja",
    description: "Apertura, cierre y resumen de caja.",
  },
  {
    id: "reportes",
    title: "Reportes",
    description: "Informes y estadísticos.",
  },
  {
    id: "configuracion",
    title: "Configuración",
    description: "Datos de la tienda y opciones.",
  },
  {
    id: "seguridad",
    title: "Seguridad",
    description: "Contraseña y acceso.",
  },
  {
    id: "usuarios",
    title: "Usuarios y permisos",
    description: "Quién puede entrar a tu tienda.",
  },
  {
    id: "faq",
    title: "Preguntas frecuentes",
    description: "Respuestas rápidas.",
  },
  {
    id: "soporte",
    title: "Solución de problemas",
    description: "Qué hacer si algo no funciona.",
  },
  {
    id: "historial",
    title: "Historial de cambios",
    description: "Versiones del producto.",
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "primeros-pasos",
    title: "Primeros pasos en INTIENDAS",
    categoryId: "primeros-pasos",
    href: "/intiendas/login",
    keywords: ["login", "entrar", "inicio", "contraseña", "correo"],
    objective: "Aprender a entrar y reconocer la pantalla principal.",
    purpose: "Es el punto de entrada seguro a tu tienda.",
    whenToUse: "Cada vez que abras INTIENDAS en el navegador o en una tablet.",
    overview:
      "INTIENDAS usa correo y contraseña que te asigna el administrador. Después del ingreso verás el menú de módulos (Dashboard).",
    steps: [
      "Abre la dirección de INTIENDAS que te compartieron.",
      "Escribe tu correo y contraseña.",
      "Pulsa «Iniciar sesión».",
      "Si olvidaste la clave, usa «¿Olvidaste tu contraseña?».",
      "En el Dashboard elige el módulo que necesitas.",
    ],
    buttons: [
      { name: "Iniciar sesión", meaning: "Entra a tu tienda con los datos correctos." },
      { name: "¿Olvidaste tu contraseña?", meaning: "Envía un código a tu correo para crear una clave nueva." },
    ],
    fields: [
      { name: "Correo electrónico", meaning: "El correo con el que te crearon la cuenta." },
      { name: "Contraseña", meaning: "Clave secreta de acceso." },
    ],
    example: "María abre INTIENDAS en la mañana, inicia sesión y elige Ventas para atender el mostrador.",
    tips: [
      "Usa Google Chrome o Edge actualizado.",
      "Si cambias de dispositivo, cierra sesión al terminar.",
    ],
    warnings: [
      "Nunca compartas tu contraseña.",
      "Si tu cuenta está inactiva, contacta a PRAGMA.",
    ],
    commonErrors: [
      "Correo o contraseña incorrectos: verifica mayúsculas y espacios.",
      "Cuenta sin tienda: pide al administrador que te asigne acceso.",
    ],
    relatedSlugs: ["dashboard", "seguridad-contrasena", "faq"],
    callouts: [
      { n: 1, label: "Logo INTIENDAS", detail: "Confirma que estás en el login correcto." },
      { n: 2, label: "Correo y contraseña", detail: "Datos de acceso." },
      { n: 3, label: "Iniciar sesión", detail: "Botón principal de entrada." },
      { n: 4, label: "Recuperar clave", detail: "Enlace debajo del formulario." },
    ],
  },
  {
    slug: "dashboard",
    title: "Dashboard (menú de módulos)",
    categoryId: "dashboard",
    href: "/intiendas/dashboard",
    keywords: ["dashboard", "inicio", "módulos", "menú", "tiles"],
    objective: "Entender el menú principal y cómo abrir cada área.",
    purpose: "Reúne todos los módulos de la tienda en una sola vista.",
    whenToUse: "Al iniciar el día o cuando necesites cambiar de tarea.",
    overview:
      "Cada tarjeta abre un módulo: Ventas, Compras, Abastecimiento, Clientes, Caja, Movimientos, Productos, Estadísticos, Informes y Configuración.",
    steps: [
      "Inicia sesión.",
      "Revisa el nombre de tu tienda en la parte superior.",
      "Pulsa la tarjeta del módulo que necesitas.",
      "Para salir, usa el ícono de cerrar sesión.",
    ],
    buttons: [
      { name: "Tarjetas de módulo", meaning: "Abren cada área de trabajo." },
      { name: "Cerrar sesión", meaning: "Sale de INTIENDAS de forma segura." },
    ],
    fields: [],
    example: "Antes de vender, abres Caja desde el Dashboard; luego entras a Ventas.",
    tips: ["Si no ves un módulo, regresa al Dashboard con el botón Inicio en Ventas."],
    warnings: ["Algunas acciones requieren caja abierta."],
    commonErrors: ["Pantalla en blanco o redirección a login: tu sesión expiró; vuelve a entrar."],
    relatedSlugs: ["ventas-pos", "abrir-cerrar-caja", "configuracion-tienda"],
    callouts: [
      { n: 1, label: "Nombre de la tienda", detail: "Cabecera central." },
      { n: 2, label: "Cuadrícula de módulos", detail: "Accesos principales." },
      { n: 3, label: "Cerrar sesión", detail: "Esquina superior derecha." },
    ],
  },
  {
    slug: "ventas-pos",
    title: "Ventas (punto de venta)",
    categoryId: "ventas",
    href: "/intiendas/ventas",
    keywords: ["ventas", "pos", "cobrar", "carrito", "efectivo", "crédito"],
    objective: "Registrar una venta completa y cobrar.",
    purpose: "Cobrar productos, aplicar descuentos y dejar ventas en espera.",
    whenToUse: "En cada venta del mostrador o domicilio.",
    overview:
      "Buscas productos, los agregas al carrito, eliges forma de pago y cobras. La caja debe estar abierta. El inventario e inteligencia de abastecimiento se actualizan al completar la venta.",
    steps: [
      "Abre caja en Configuración si aún no está abierta.",
      "Entra a Ventas.",
      "Busca el producto y súmalo al carrito.",
      "Ajusta cantidades con + / −.",
      "Elige pago (efectivo, transferencia, crédito) y cobra.",
    ],
    buttons: [
      { name: "Ventas en espera", meaning: "Guarda o recupera una venta sin cobrar." },
      { name: "Inicio", meaning: "Vuelve al Dashboard." },
      { name: "Cobrar / Completar", meaning: "Cierra la venta y descuenta inventario." },
      { name: "Pausar (espera)", meaning: "Deja la venta pendiente para retomarla." },
    ],
    fields: [
      { name: "Buscar", meaning: "Nombre, código o código de barras." },
      { name: "Cantidad", meaning: "Unidades del producto." },
      { name: "Descuento", meaning: "Monto a restar del total (si aplica)." },
      { name: "Cliente", meaning: "Obligatorio si vendes a crédito." },
    ],
    example: "Vendes 2 panes y un café en efectivo; el stock baja al instante.",
    tips: ["Usa ventas en espera si el cliente se demora pagando."],
    warnings: [
      "Sin caja abierta no puedes completar ventas.",
      "El crédito requiere cliente seleccionado.",
    ],
    commonErrors: [
      "Stock insuficiente: revisa inventario o ajusta cantidad.",
      "Monto pagado menor al total en efectivo.",
    ],
    relatedSlugs: ["abrir-cerrar-caja", "clientes", "productos-lista"],
    callouts: [
      { n: 1, label: "Buscador", detail: "Encuentra productos rápido." },
      { n: 2, label: "Carrito", detail: "Ítems de la venta actual." },
      { n: 3, label: "Cobro", detail: "Método de pago y totales." },
      { n: 4, label: "Ventas en espera", detail: "Lista de ventas pausadas." },
    ],
  },
  {
    slug: "compras",
    title: "Compras",
    categoryId: "compras",
    href: "/intiendas/compras",
    keywords: ["compras", "gasto", "mercancía", "proveedor", "historial"],
    objective: "Registrar compras o gastos reales de la tienda.",
    purpose: "Llevar el historial de lo que compraste (no es el módulo de sugerencias IA).",
    whenToUse: "Cuando recibes mercancía o pagas un gasto a proveedor.",
    overview:
      "Aquí registras compras con o sin producto vinculado. Las sugerencias inteligentes están en Centro de Abastecimiento.",
    steps: [
      "Abre caja si el flujo lo requiere.",
      "Entra a Compras.",
      "Describe la compra e indica el monto.",
      "Si es mercancía de un producto, selecciónalo y la cantidad.",
      "Guarda para actualizar historial e inventario cuando aplica.",
    ],
    buttons: [
      { name: "Registrar compra", meaning: "Guarda el documento en el historial." },
    ],
    fields: [
      { name: "Concepto / descripción", meaning: "Qué compraste." },
      { name: "Monto", meaning: "Valor total en pesos." },
      { name: "Proveedor", meaning: "Opcional; debe ser de tu tienda." },
      { name: "Producto y cantidad", meaning: "Si recibes stock de un producto existente." },
    ],
    example: "Registras la compra de harina al proveedor semanal y el stock sube.",
    tips: ["Para pedidos sugeridos por el sistema usa Centro de Abastecimiento."],
    warnings: ["No confundas Compras (historial) con Pedidos/Abastecimiento (sugerencias)."],
    commonErrors: ["Monto en cero: el sistema pide un valor válido."],
    relatedSlugs: ["abastecimiento", "proveedores", "abrir-cerrar-caja"],
    callouts: [
      { n: 1, label: "Formulario de registro", detail: "Datos de la compra." },
      { n: 2, label: "Historial", detail: "Compras anteriores." },
    ],
  },
  {
    slug: "abastecimiento",
    title: "Centro de Abastecimiento",
    categoryId: "abastecimiento",
    href: "/intiendas/pedidos",
    keywords: ["pedidos", "abastecimiento", "sugerencias", "proveedor", "whatsapp", "ia"],
    objective: "Revisar qué conviene pedir y avisar al proveedor.",
    purpose: "Muestra sugerencias basadas en ventas y stock (sin inventar pedidos a ciegas).",
    whenToUse: "Cuando hay productos críticos o quieres planear la compra de la semana.",
    overview:
      "Ves un briefing del día, tarjetas por proveedor y productos con cantidad sugerida. Puedes editar, enviar por WhatsApp/correo (previa vista) o descartar. El aprendizaje mejora con tus ajustes.",
    steps: [
      "Entra a Centro de Abastecimiento.",
      "Lee el resumen de lo que toca hoy.",
      "Abre un proveedor y revisa productos.",
      "Ajusta cantidades si hace falta.",
      "Usa Revisar → vista previa → enviar o copiar el mensaje.",
    ],
    buttons: [
      { name: "Revisar", meaning: "Abre el detalle del pedido sugerido." },
      { name: "Enviar / WhatsApp / Correo", meaning: "Preparan el mensaje (con confirmación)." },
      { name: "Aprobar / Descartar", meaning: "Confirma o elimina la sugerencia." },
    ],
    fields: [
      { name: "Cantidad sugerida", meaning: "Unidades recomendadas; puedes cambiarlas." },
      { name: "Notas", meaning: "Texto adicional para el proveedor." },
    ],
    example: "El sistema marca harina como urgente; envías el pedido por WhatsApp al proveedor habitual.",
    tips: ["Prioridad Urgente / Pronto / Normal te ayuda a ordenar el día."],
    warnings: ["Las sugerencias no reemplazan tu criterio comercial."],
    commonErrors: ["Sin sugerencias: el stock puede estar sano; no es un error."],
    relatedSlugs: ["compras", "proveedores", "productos-lista"],
    callouts: [
      { n: 1, label: "Briefing del día", detail: "Qué hacer ahora." },
      { n: 2, label: "Tarjetas de proveedor", detail: "Pedidos agrupados." },
      { n: 3, label: "Productos y motivos", detail: "Por qué conviene pedir." },
    ],
  },
  {
    slug: "clientes",
    title: "Clientes",
    categoryId: "clientes",
    href: "/intiendas/clientes",
    keywords: ["clientes", "fiado", "crédito", "pago"],
    objective: "Crear y administrar clientes y abonos.",
    purpose: "Guardar datos de clientes y controlar saldos a crédito.",
    whenToUse: "Al vender fiado o registrar un pago de cliente.",
    overview: "Lista de clientes con búsqueda, creación, edición y registro de pagos que bajan el saldo.",
    steps: [
      "Entra a Clientes.",
      "Busca o crea un cliente.",
      "Completa nombre y datos útiles.",
      "Si hay saldo, registra un pago.",
    ],
    buttons: [
      { name: "Nuevo / Guardar", meaning: "Crea o actualiza el cliente." },
      { name: "Registrar pago", meaning: "Reduce el saldo a favor de la tienda." },
      { name: "Eliminar", meaning: "Desactiva el cliente (no borra historial crítico)." },
    ],
    fields: [
      { name: "Nombre", meaning: "Cómo aparece en ventas." },
      { name: "Documento / teléfono", meaning: "Identificación de contacto (si los usas)." },
      { name: "Monto del pago", meaning: "Valor abonado al saldo." },
    ],
    example: "Un cliente paga $50.000 de su fiado; el saldo baja en Clientes.",
    tips: ["Asocia el cliente en la venta a crédito antes de cobrar."],
    warnings: ["Revisa el límite de crédito si está configurado."],
    commonErrors: ["Pago sin cliente válido."],
    relatedSlugs: ["ventas-pos", "faq"],
    callouts: [
      { n: 1, label: "Lista / búsqueda", detail: "Encuentra clientes." },
      { n: 2, label: "Formulario", detail: "Alta o edición." },
    ],
  },
  {
    slug: "abrir-cerrar-caja",
    title: "Abrir y cerrar caja",
    categoryId: "caja",
    href: "/intiendas/configuracion",
    keywords: ["caja", "abrir", "cerrar", "base", "efectivo"],
    objective: "Controlar el efectivo del turno.",
    purpose: "La caja abierta habilita ventas y varias operaciones de dinero.",
    whenToUse: "Al iniciar y al cerrar el día o el turno.",
    overview:
      "Abres caja en Configuración con una base inicial. El resumen lo ves en Resumen de caja. Al cerrar indicas el efectivo contado.",
    steps: [
      "Ve a Configuración.",
      "En «Caja registradora» indica la base inicial y pulsa Abrir caja.",
      "Trabaja el día (ventas, compras según corresponda).",
      "En Resumen de caja revisa totales.",
      "Cierra indicando el efectivo final.",
    ],
    buttons: [
      { name: "Abrir caja", meaning: "Inicia el turno." },
      { name: "Cerrar caja", meaning: "Termina el turno con el efectivo contado." },
    ],
    fields: [
      { name: "Base inicial / openingAmount", meaning: "Efectivo con el que abres." },
      { name: "Efectivo al cierre", meaning: "Lo que hay en la gaveta al cerrar." },
    ],
    example: "Abres con $100.000 y cierras al final con el conteo real.",
    tips: ["Revisa Resumen de caja antes de cerrar."],
    warnings: ["No puedes abrir otra caja si ya hay una abierta."],
    commonErrors: ["Intentar vender sin caja abierta."],
    relatedSlugs: ["resumen-caja", "ventas-pos", "configuracion-tienda"],
    callouts: [
      { n: 1, label: "Tarjeta de caja", detail: "En Configuración." },
      { n: 2, label: "Base / cierre", detail: "Campos de efectivo." },
    ],
  },
  {
    slug: "resumen-caja",
    title: "Resumen de caja",
    categoryId: "caja",
    href: "/intiendas/caja",
    keywords: ["resumen", "caja", "ventas", "egresos"],
    objective: "Ver el estado de la caja del turno.",
    purpose: "Resume ventas, compras y efectivo estimado.",
    whenToUse: "Durante el día o antes de cerrar.",
    overview: "Muestra caja actual, ventas en efectivo/crédito y compras del turno.",
    steps: [
      "Abre Resumen de caja desde el Dashboard.",
      "Revisa ingresos y egresos.",
      "Si necesitas el detalle largo, ve a Informes.",
    ],
    buttons: [
      { name: "Ver detalle", meaning: "Lleva a Informes cuando está disponible." },
    ],
    fields: [],
    example: "Comparas la caja actual del resumen con el efectivo físico.",
    tips: ["Úsalo como control, no como única contabilidad formal."],
    warnings: [],
    commonErrors: ["Sin caja abierta verás estados vacíos o aviso de apertura."],
    relatedSlugs: ["abrir-cerrar-caja", "informes"],
    callouts: [
      { n: 1, label: "Tarjeta principal", detail: "Usuario, apertura y caja actual." },
      { n: 2, label: "Ventas y compras", detail: "Totales del turno." },
    ],
  },
  {
    slug: "movimientos",
    title: "Movimientos de inventario",
    categoryId: "inventario",
    href: "/intiendas/movimientos",
    keywords: ["movimientos", "kardex", "historial", "stock"],
    objective: "Consultar entradas y salidas de mercancía.",
    purpose: "Auditoría simple de qué entró o salió del inventario.",
    whenToUse: "Cuando dudes del stock de un producto.",
    overview: "Lista cronológica de movimientos (ventas, compras, ajustes, traslados).",
    steps: ["Entra a Movimientos.", "Revisa fechas y tipos.", "Localiza el producto que te interesa."],
    buttons: [],
    fields: [],
    example: "Ves un ajuste negativo y confirmas quién lo hizo según la nota.",
    tips: ["Complementa con la lista de productos."],
    warnings: [],
    commonErrors: [],
    relatedSlugs: ["ajuste-inventario", "productos-lista"],
    callouts: [{ n: 1, label: "Tabla de movimientos", detail: "Historial operativo." }],
  },
  {
    slug: "productos-hub",
    title: "Productos (menú)",
    categoryId: "productos",
    href: "/intiendas/inventario",
    keywords: ["productos", "hub", "inventario", "menú"],
    objective: "Entrar al menú de productos e inventario.",
    purpose: "Atajos a lista, proveedores, devoluciones, ajuste y traslado.",
    whenToUse: "Cuando trabajas el catálogo o el stock.",
    overview: "Pantalla intermedia con submódulos de producto.",
    steps: ["Abre Productos.", "Elige el submódulo (Lista, Proveedores, etc.)."],
    buttons: [
      { name: "Productos", meaning: "Lista editable del catálogo." },
      { name: "Proveedores", meaning: "Directorio de proveedores." },
      { name: "Devoluciones / Ajuste / Traslado", meaning: "Operaciones de stock." },
    ],
    fields: [],
    example: "Desde el hub abres Lista para crear un producto nuevo.",
    tips: [],
    warnings: [],
    commonErrors: [],
    relatedSlugs: ["productos-lista", "ajuste-inventario", "traslado"],
    callouts: [{ n: 1, label: "Tarjetas de submódulo", detail: "Accesos de inventario." }],
  },
  {
    slug: "productos-lista",
    title: "Lista de productos",
    categoryId: "productos",
    href: "/intiendas/inventario/lista",
    keywords: ["producto", "sku", "precio", "stock", "categoría"],
    objective: "Crear y editar productos de la tienda.",
    purpose: "Mantener precios, costos y existencias base.",
    whenToUse: "Al llegar mercancía nueva o cambiar precios.",
    overview: "Formulario y tabla de productos activos de tu tienda.",
    steps: [
      "Abre Lista de productos.",
      "Completa nombre, precio y costo.",
      "Opcional: categoría, proveedor, stock mínimo/ideal.",
      "Guarda. El stock inicial genera movimiento si lo indicas.",
    ],
    buttons: [
      { name: "Guardar / Crear", meaning: "Registra el producto." },
      { name: "Editar / Eliminar", meaning: "Actualiza o desactiva." },
    ],
    fields: [
      { name: "Nombre", meaning: "Cómo se busca en el POS." },
      { name: "SKU / Código de barras", meaning: "Identificadores opcionales." },
      { name: "Precio / Costo", meaning: "Venta y costo unitario." },
      { name: "Stock / Mínimo / Ideal", meaning: "Existencia y objetivos." },
      { name: "Categoría / Proveedor", meaning: "Solo de tu misma tienda." },
    ],
    example: "Creas «Pan tajado» con precio $4.000 y stock 20.",
    tips: ["Define mínimo e ideal para mejores sugerencias de abastecimiento."],
    warnings: ["Categoría o proveedor de otra tienda serán rechazados."],
    commonErrors: ["Nombre vacío."],
    relatedSlugs: ["ventas-pos", "abastecimiento", "ajuste-inventario"],
    callouts: [
      { n: 1, label: "Formulario", detail: "Alta de producto." },
      { n: 2, label: "Tabla", detail: "Catálogo actual." },
    ],
  },
  {
    slug: "proveedores",
    title: "Proveedores",
    categoryId: "productos",
    href: "/intiendas/proveedores",
    keywords: ["proveedor", "whatsapp", "lead time", "entrega"],
    objective: "Registrar proveedores y sus datos de contacto.",
    purpose: "Usarlos en compras y en mensajes de abastecimiento.",
    whenToUse: "Cuando trabajas con un proveedor nuevo o actualizas WhatsApp/correo.",
    overview: "CRUD de proveedores: nombre, contacto, plazos y días habituales.",
    steps: ["Entra a Proveedores.", "Crea o edita.", "Guarda WhatsApp y correo si los usas para pedidos."],
    buttons: [
      { name: "Guardar", meaning: "Crea o actualiza." },
      { name: "Eliminar", meaning: "Desactiva el proveedor." },
    ],
    fields: [
      { name: "Nombre", meaning: "Razón comercial." },
      { name: "WhatsApp / Teléfono / Correo", meaning: "Canales de pedido." },
      { name: "Lead time (días)", meaning: "Demora típica de entrega." },
    ],
    example: "Guardas el WhatsApp del proveedor de lácteos para enviar pedidos.",
    tips: ["Un buen lead time mejora las recomendaciones."],
    warnings: [],
    commonErrors: ["Nombre vacío."],
    relatedSlugs: ["abastecimiento", "compras"],
    callouts: [{ n: 1, label: "Formulario y lista", detail: "Directorio de proveedores." }],
  },
  {
    slug: "ajuste-inventario",
    title: "Ajuste de inventario",
    categoryId: "inventario",
    href: "/intiendas/inventario/ajuste",
    keywords: ["ajuste", "stock", "merma", "conteo"],
    objective: "Corregir existencias cuando el conteo físico no coincide.",
    purpose: "Subir o bajar stock con una nota.",
    whenToUse: "Después de un inventario físico o una merma.",
    overview: "Eliges producto, cantidad (+/−) y una nota; se crea un movimiento.",
    steps: [
      "Entra a Ajuste de inventario.",
      "Elige el producto.",
      "Indica cantidad positiva o negativa.",
      "Escribe una nota clara y guarda.",
    ],
    buttons: [{ name: "Guardar ajuste", meaning: "Aplica el cambio de stock." }],
    fields: [
      { name: "Producto", meaning: "Ítem a corregir." },
      { name: "Cantidad", meaning: "Diferencia a aplicar." },
      { name: "Nota", meaning: "Motivo del ajuste." },
    ],
    example: "Encuentras 3 unidades rotas y ajustas −3 con nota «merma».",
    tips: ["Prefiere notas cortas y claras para auditoría."],
    warnings: ["El stock no puede quedar negativo."],
    commonErrors: ["Cantidad cero."],
    relatedSlugs: ["movimientos", "productos-lista"],
    callouts: [{ n: 1, label: "Formulario de ajuste", detail: "Producto, cantidad y nota." }],
  },
  {
    slug: "devoluciones",
    title: "Devoluciones",
    categoryId: "inventario",
    href: "/intiendas/inventario/devoluciones",
    keywords: ["devolución", "retorno", "cliente"],
    objective: "Registrar devoluciones que afectan el stock.",
    purpose: "Devolver unidades al inventario con control.",
    whenToUse: "Cuando un cliente devuelve mercancía vendible.",
    overview: "Usa el flujo de ajuste tipificado como devolución según la pantalla.",
    steps: ["Abre Devoluciones.", "Indica producto y cantidad.", "Confirma con nota."],
    buttons: [{ name: "Registrar", meaning: "Aplica la devolución al stock." }],
    fields: [
      { name: "Producto", meaning: "Ítem devuelto." },
      { name: "Cantidad", meaning: "Unidades." },
      { name: "Nota", meaning: "Motivo." },
    ],
    example: "Devuelven un paquete cerrado; sube 1 al stock.",
    tips: [],
    warnings: ["No uses devolución para mermas no recuperables; usa ajuste."],
    commonErrors: [],
    relatedSlugs: ["ajuste-inventario", "ventas-pos"],
    callouts: [{ n: 1, label: "Formulario", detail: "Datos de la devolución." }],
  },
  {
    slug: "traslado",
    title: "Traslado entre bodegas",
    categoryId: "inventario",
    href: "/intiendas/inventario/traslado",
    keywords: ["traslado", "bodega", "warehouse"],
    objective: "Mover stock entre bodegas de la misma tienda.",
    purpose: "Mantener existencias correctas por ubicación.",
    whenToUse: "Cuando mueves mercancía de bodega a sala o entre bodegas.",
    overview: "Selecciona producto, bodega origen, destino y cantidad.",
    steps: [
      "Crea bodegas si aún no existen (desde el flujo de traslado/configuración disponible).",
      "Elige origen, destino y cantidad.",
      "Confirma el traslado.",
    ],
    buttons: [
      { name: "Trasladar", meaning: "Ejecuta el movimiento entre bodegas." },
      { name: "Crear / editar bodega", meaning: "Administra ubicaciones (si está en pantalla)." },
    ],
    fields: [
      { name: "Producto", meaning: "Qué se mueve." },
      { name: "Desde / Hasta", meaning: "Bodegas." },
      { name: "Cantidad", meaning: "Unidades." },
    ],
    example: "Trasladás 10 unidades de bodega a mostrador.",
    tips: [],
    warnings: ["Origen y destino deben ser distintos."],
    commonErrors: ["Stock insuficiente en origen."],
    relatedSlugs: ["movimientos", "productos-lista"],
    callouts: [{ n: 1, label: "Formulario de traslado", detail: "Origen, destino y cantidad." }],
  },
  {
    slug: "estadisticos",
    title: "Estadísticos",
    categoryId: "reportes",
    href: "/intiendas/estadisticas",
    keywords: ["estadísticos", "gráficas", "ventas", "periodo"],
    objective: "Ver un resumen de desempeño reciente.",
    purpose: "Totales de ventas/compras y productos top en una ventana de días.",
    whenToUse: "Para una mirada rápida del mes reciente.",
    overview: "Indicadores agregados (ventana ~30 días en zona Bogotá).",
    steps: ["Abre Estadísticos.", "Revisa totales y productos más vendidos."],
    buttons: [],
    fields: [],
    example: "Ves que el producto top de la quincena es el café.",
    tips: ["Para detalle diario usa Informes."],
    warnings: [],
    commonErrors: [],
    relatedSlugs: ["informes", "ventas-pos"],
    callouts: [{ n: 1, label: "Indicadores", detail: "Totales y ranking." }],
  },
  {
    slug: "informes",
    title: "Informes",
    categoryId: "reportes",
    href: "/intiendas/reportes",
    keywords: ["informes", "reportes", "ventas", "compras"],
    objective: "Consultar reportes operativos de la tienda.",
    purpose: "Ver ventas, compras y cifras de apoyo a la gestión.",
    whenToUse: "Al cerrar el día o la semana.",
    overview: "Pantalla de informes con totales según el período mostrado.",
    steps: ["Entra a Informes.", "Revisa las secciones disponibles.", "Contrasta con caja si es cierre."],
    buttons: [],
    fields: [],
    example: "Comparas ventas del informe con el efectivo de caja.",
    tips: [],
    warnings: [],
    commonErrors: [],
    relatedSlugs: ["estadisticos", "resumen-caja"],
    callouts: [{ n: 1, label: "Bloques de informe", detail: "Totales por tipo." }],
  },
  {
    slug: "configuracion-tienda",
    title: "Configuración de la tienda",
    categoryId: "configuracion",
    href: "/intiendas/configuracion",
    keywords: ["configuración", "nombre", "tienda", "ayuda", "seguridad"],
    objective: "Cambiar datos de la tienda y acceder a Ayuda y Seguridad.",
    purpose: "Centro de opciones: nombre comercial, caja, ayuda y contraseña.",
    whenToUse: "Al renombrar la tienda o al buscar el manual / cambiar clave.",
    overview:
      "Desde Configuración gestionas el nombre, abres/cierras caja y entras al Centro de Ayuda y a Seguridad.",
    steps: [
      "Abre Configuración.",
      "Edita el nombre y guarda si cambió.",
      "Usa las tarjetas Centro de Ayuda o Seguridad según necesites.",
    ],
    buttons: [
      { name: "Guardar cambios", meaning: "Actualiza el nombre de la tienda." },
      { name: "Centro de Ayuda", meaning: "Abre este manual interactivo." },
      { name: "Seguridad", meaning: "Cambiar contraseña." },
    ],
    fields: [
      { name: "Nombre comercial", meaning: "Nombre visible en la cabecera." },
    ],
    example: "Cambias el nombre a «Panadería Marival» y guardas.",
    tips: ["Descarga el PDF del manual desde el Centro de Ayuda."],
    warnings: [],
    commonErrors: [],
    relatedSlugs: ["abrir-cerrar-caja", "centro-de-ayuda", "seguridad-contrasena"],
    callouts: [
      { n: 1, label: "Datos de la tienda", detail: "Nombre y moneda." },
      { n: 2, label: "Caja", detail: "Apertura/cierre." },
      { n: 3, label: "Ayuda y Seguridad", detail: "Accesos adicionales." },
    ],
  },
  {
    slug: "centro-de-ayuda",
    title: "Cómo usar el Centro de Ayuda",
    categoryId: "configuracion",
    href: "/intiendas/configuracion/ayuda",
    keywords: ["ayuda", "manual", "pdf", "buscar", "artículo"],
    objective: "Encontrar respuestas y descargar el manual.",
    purpose: "Es la única documentación oficial para usuarios de INTIENDAS.",
    whenToUse: "Cuando tengas una duda de cualquier módulo.",
    overview: "Busca por palabra, navega por categorías o descarga el PDF completo.",
    steps: [
      "Configuración → Centro de Ayuda.",
      "Escribe en el buscador o elige una categoría.",
      "Abre el artículo.",
      "Usa Anterior/Siguiente o Descargar Manual.",
    ],
    buttons: [
      { name: "Buscar", meaning: "Filtra artículos." },
      { name: "Descargar Manual", meaning: "Genera el PDF al instante." },
      { name: "Anterior / Siguiente", meaning: "Navega la guía." },
    ],
    fields: [{ name: "Buscador", meaning: "Palabras clave, botones o módulos." }],
    example: "Buscas «caja» y abres Abrir y cerrar caja.",
    tips: ["El PDF siempre refleja la versión actual del Centro de Ayuda."],
    warnings: ["No uses manuales externos; pueden estar desactualizados."],
    commonErrors: [],
    relatedSlugs: ["faq", "configuracion-tienda"],
    callouts: [
      { n: 1, label: "Buscador", detail: "Arriba." },
      { n: 2, label: "Categorías", detail: "Índice." },
      { n: 3, label: "Descargar Manual", detail: "Exportación PDF." },
    ],
  },
  {
    slug: "seguridad-contrasena",
    title: "Cambiar y recuperar contraseña",
    categoryId: "seguridad",
    href: "/intiendas/configuracion/seguridad",
    keywords: ["contraseña", "seguridad", "olvidé", "clave", "password"],
    objective: "Administrar tu clave sin llamar al administrador.",
    purpose: "Proteger el acceso a los datos del negocio.",
    whenToUse: "Si olvidaste la clave o quieres renovarla.",
    overview:
      "Desde el login recuperas con código por correo (Clerk). Autenticado, cambias la clave en Configuración → Seguridad.",
    steps: [
      "¿Olvidé?: Login → enlace → correo → código → nueva clave.",
      "Cambio: Seguridad → contraseña actual → nueva → confirmar → guardar.",
    ],
    buttons: [
      { name: "Enviar código", meaning: "Solicita el correo de recuperación." },
      { name: "Guardar contraseña", meaning: "Aplica el cambio estando logueado." },
    ],
    fields: [
      { name: "Contraseña actual", meaning: "La que usas hoy." },
      { name: "Nueva / Confirmación", meaning: "Deben coincidir y cumplir la política." },
    ],
    example: "Olvidaste la clave el lunes; recibes el código y entras el mismo día.",
    tips: ["Usa una clave larga y única."],
    warnings: [
      "Por seguridad el sistema no confirma si un correo está registrado.",
      "Los códigos expiran.",
    ],
    commonErrors: ["Código vencido: solicita uno nuevo.", "Confirmación distinta a la nueva clave."],
    relatedSlugs: ["primeros-pasos", "faq"],
    callouts: [
      { n: 1, label: "Formulario de seguridad", detail: "Cambio de clave." },
      { n: 2, label: "Recuperación en login", detail: "Flujo con código." },
    ],
  },
  {
    slug: "usuarios-permisos",
    title: "Usuarios y permisos",
    categoryId: "usuarios",
    href: "/intiendas/configuracion",
    keywords: ["usuarios", "permisos", "admin", "owner", "acceso"],
    objective: "Entender quién puede entrar a tu tienda.",
    purpose: "Los usuarios de INTIENDAS los crea el administrador desde el panel Owner de PRAGMA.",
    whenToUse: "Cuando necesitas un cajero nuevo o suspender a alguien.",
    overview:
      "No hay alta de usuarios dentro del POS. Solicita al administrador de PRAGMA que cree o active la cuenta con tienda asignada.",
    steps: [
      "Pide al administrador el correo del nuevo usuario.",
      "Cuando te confirmen, la persona entra por /intiendas/login.",
      "Si no tiene tienda, verá un mensaje de acceso denegado.",
    ],
    buttons: [],
    fields: [],
    example: "El dueño pide a PRAGMA un usuario para el turno noche.",
    tips: ["Cada persona debe tener su propio correo."],
    warnings: ["No compartas una sola cuenta entre varios turnos."],
    commonErrors: ["«Sin acceso a INTIENDAS»: falta asignación de tienda."],
    relatedSlugs: ["primeros-pasos", "faq"],
    callouts: [{ n: 1, label: "Login", detail: "Único punto de entrada del usuario final." }],
  },
  {
    slug: "faq",
    title: "Preguntas frecuentes",
    categoryId: "faq",
    href: "/intiendas/configuracion/ayuda",
    keywords: ["faq", "dudas", "preguntas"],
    objective: "Responder lo más consultado.",
    purpose: "Atajos de ayuda.",
    whenToUse: "Antes de contactar soporte.",
    overview: "Compilación de dudas comunes del día a día.",
    steps: ["Lee la pregunta que se parece a tu caso.", "Abre el artículo relacionado."],
    buttons: [],
    fields: [],
    example: "«¿Por qué no puedo vender?» → falta abrir caja.",
    tips: [],
    warnings: [],
    commonErrors: [
      "No puedo vender → Abrir caja.",
      "No hay pedidos sugeridos → stock saludable.",
      "No entro → recuperar contraseña o pedir activación.",
    ],
    relatedSlugs: ["abrir-cerrar-caja", "seguridad-contrasena", "abastecimiento"],
    callouts: [],
  },
  {
    slug: "solucion-problemas",
    title: "Solución de problemas",
    categoryId: "soporte",
    href: "/intiendas/configuracion/ayuda",
    keywords: ["error", "problema", "soporte", "falla"],
    objective: "Resolver fallas frecuentes antes de escalar.",
    purpose: "Checklist rápido de recuperación.",
    whenToUse: "Cuando una pantalla no carga o una acción falla.",
    overview: "Pasos genéricos: sesión, caja, red y mensaje de error.",
    steps: [
      "Copia el mensaje de error exacto.",
      "Cierra sesión y vuelve a entrar.",
      "Prueba en otra pestaña o dispositivo.",
      "Verifica caja abierta si era una venta.",
      "Si persiste, contacta a PRAGMA con fecha/hora y pantalla.",
    ],
    buttons: [],
    fields: [],
    example: "El cobro falla; reabres sesión y la venta se completa.",
    tips: ["Incluye captura al reportar."],
    warnings: [],
    commonErrors: [],
    relatedSlugs: ["faq", "centro-de-ayuda"],
    callouts: [],
  },
  {
    slug: "historial-cambios",
    title: "Historial de cambios",
    categoryId: "historial",
    keywords: ["versión", "changelog", "novedades"],
    objective: "Conocer la versión del producto y del manual.",
    purpose: "Transparencia de qué incluye cada release de ayuda.",
    whenToUse: "Después de una actualización o al descargar el PDF.",
    overview: `Versión actual del producto/help: ${HELP_MANUAL_VERSION}. Incluye Centro de Ayuda, exportación PDF y gestión de contraseña con Clerk.`,
    steps: ["Revisa el pie de pantalla (versión).", "Descarga el PDF para archivar la versión del día."],
    buttons: [{ name: "Descargar Manual", meaning: "PDF con la versión impresa en portada." }],
    fields: [],
    example: "Archivas el PDF del mes como evidencia de capacitación.",
    tips: [],
    warnings: [],
    commonErrors: [],
    relatedSlugs: ["centro-de-ayuda"],
    callouts: [],
  },
];

export function getHelpArticle(slug: string): HelpArticle | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function getArticlesByCategory(categoryId: HelpCategoryId): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.categoryId === categoryId);
}

export function getAdjacentArticles(slug: string): {
  prev: HelpArticle | null;
  next: HelpArticle | null;
} {
  const idx = HELP_ARTICLES.findIndex((a) => a.slug === slug);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? HELP_ARTICLES[idx - 1]! : null,
    next: idx < HELP_ARTICLES.length - 1 ? HELP_ARTICLES[idx + 1]! : null,
  };
}

export function searchHelpArticles(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELP_ARTICLES;
  return HELP_ARTICLES.filter((article) => {
    const hay = [
      article.title,
      article.objective,
      article.overview,
      ...article.keywords,
      ...article.buttons.map((b) => b.name),
      ...article.fields.map((f) => f.name),
      ...article.steps,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Audited route → article mapping (real INTIENDAS surfaces only). */
export const HELP_ROUTE_AUDIT = [
  { path: "/intiendas/login", articleSlug: "primeros-pasos" },
  { path: "/intiendas/dashboard", articleSlug: "dashboard" },
  { path: "/intiendas/ventas", articleSlug: "ventas-pos" },
  { path: "/intiendas/compras", articleSlug: "compras" },
  { path: "/intiendas/pedidos", articleSlug: "abastecimiento" },
  { path: "/intiendas/clientes", articleSlug: "clientes" },
  { path: "/intiendas/caja", articleSlug: "resumen-caja" },
  { path: "/intiendas/movimientos", articleSlug: "movimientos" },
  { path: "/intiendas/inventario", articleSlug: "productos-hub" },
  { path: "/intiendas/inventario/lista", articleSlug: "productos-lista" },
  { path: "/intiendas/proveedores", articleSlug: "proveedores" },
  { path: "/intiendas/inventario/ajuste", articleSlug: "ajuste-inventario" },
  { path: "/intiendas/inventario/devoluciones", articleSlug: "devoluciones" },
  { path: "/intiendas/inventario/traslado", articleSlug: "traslado" },
  { path: "/intiendas/estadisticas", articleSlug: "estadisticos" },
  { path: "/intiendas/reportes", articleSlug: "informes" },
  { path: "/intiendas/configuracion", articleSlug: "configuracion-tienda" },
  { path: "/intiendas/configuracion/ayuda", articleSlug: "centro-de-ayuda" },
  { path: "/intiendas/configuracion/seguridad", articleSlug: "seguridad-contrasena" },
] as const;
