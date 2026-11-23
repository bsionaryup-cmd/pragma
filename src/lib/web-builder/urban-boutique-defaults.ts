import { WebSiteTemplate } from "@prisma/client";

/** Paleta oficial manual de marca URBA NOVA */
export const BRAND_COLORS = {
  softWhite: "#F6F4F1",
  sandOak: "#D8C7AE",
  urbanGray: "#7C7A78",
  stoneTaupe: "#8B7E72",
  matteBlack: "#1F1F1F",
  /** Olive Leaf — botones e interactivos */
  accentOlive: "#6E7862",
  footerOlive: "#3F4520",
} as const;

/** Preset editable desde /web-builder → Diseño (identidad Urban Boutique) */
export const URBAN_BOUTIQUE_IDENTITY_PRESET = {
  primaryColor: BRAND_COLORS.matteBlack,
  accentColor: BRAND_COLORS.accentOlive,
  softWhite: BRAND_COLORS.softWhite,
  sandOak: BRAND_COLORS.sandOak,
  urbanGray: BRAND_COLORS.urbanGray,
  stoneTaupe: BRAND_COLORS.stoneTaupe,
  matteBlack: BRAND_COLORS.matteBlack,
  fontFamily: "montserrat-poppins",
} as const;

/** Staging / piloto: assets locales autorizados como comps de diseño */
export const URBANOVA_PUBLIC_ASSETS = {
  hero: "/web-builder/urbanova/hero.jpg",
  location: "/web-builder/urbanova/location.jpg",
  loft801: "/web-builder/urbanova/loft-801.jpg",
  loft802: "/web-builder/urbanova/loft-802.jpg",
  loft803: "/web-builder/urbanova/loft-803.jpg",
  loft804: "/web-builder/urbanova/loft-804.jpg",
} as const;

/** Hero eyebrow — no DB field; template + staging seed reference this constant */
export const URBAN_BOUTIQUE_HERO_EYEBROW = "ESTANCIAS CORTAS" as const;

const LAURELES_MAPS_SEARCH_URL =
  "https://www.google.com/maps/search/?api=1&query=Laureles%2C+Medell%C3%ADn%2C+Colombia";

export const URBAN_BOUTIQUE_DEFAULTS = {
  template: WebSiteTemplate.URBAN_BOUTIQUE,
  primaryColor: BRAND_COLORS.matteBlack,
  accentColor: BRAND_COLORS.accentOlive,
  softWhite: BRAND_COLORS.softWhite,
  sandOak: BRAND_COLORS.sandOak,
  urbanGray: BRAND_COLORS.urbanGray,
  stoneTaupe: BRAND_COLORS.stoneTaupe,
  matteBlack: BRAND_COLORS.matteBlack,
  fontFamily: "montserrat-poppins",
  currency: "COP",
  locale: "es",
  bookingEnabled: true,
  heroTitle: "Tu espacio urbano, con alma boutique",
  heroSubtitle:
    "Hospedaje cuidado, diseño contemporáneo y la calidez de un hotel pequeño.",
  heroImageUrl: null as string | null,
  aboutText: null as string | null,
  locationCountry: "Colombia",
} as const;

const PILOT_SEO_TITLE =
  "URBA NOVA LOFT 33 | Lofts amoblados en Laureles, Medellín";
const PILOT_SEO_DESCRIPTION =
  "Disfruta de una estancia cómoda en Laureles, Medellín. Conoce nuestros lofts amoblados, consulta disponibilidad y reserva directamente.";

export const URBANOVA_PILOT_CONTENT = {
  slug: "urbanovaloft",
  siteName: "URBA NOVA LOFT 33",
  ...URBAN_BOUTIQUE_DEFAULTS,
  heroTitle: "Tu hogar fuera de casa en Laureles, Medellín",
  heroSubtitle: "LOFTS AMOBLADOS · AIRBNB EN MEDELLÍN",
  heroImageUrl: URBANOVA_PUBLIC_ASSETS.hero as string,
  aboutText:
    "URBA Nova Loft 33 es una marca de hospitalidad urbana que ofrece espacios modernos, funcionales y bien diseñados para estancias cortas en la ciudad.",
  locationNeighborhood: "Laureles",
  locationCity: "Medellín",
  locationCountry: "Colombia",
  locationDescription:
    "Descubre Laureles, uno de los sectores más atractivos de Medellín, con una excelente oferta gastronómica, comercial y cultural.",
  locationImageUrl: URBANOVA_PUBLIC_ASSETS.location as string,
  locationMapUrl: LAURELES_MAPS_SEARCH_URL,
  seoTitle: PILOT_SEO_TITLE,
  seoDescription: PILOT_SEO_DESCRIPTION,
  seoCanonicalUrl: null as string | null,
  ogImageUrl: null as string | null,
  contactEmail: "urbanovaloft@gmail.com",
  whatsapp: null as string | null,
  instagramUrl: null as string | null,
  facebookUrl: null as string | null,
} as const;

export const URBANOVA_DEFAULT_PAGES = [
  {
    slug: "inicio",
    title: "Inicio",
    sortOrder: 0,
    body: null as string | null,
  },
  {
    slug: "alojamientos",
    title: "Alojamientos",
    sortOrder: 10,
    body: "Explora nuestras unidades disponibles y reserva directamente con disponibilidad en tiempo real.",
  },
  {
    slug: "ubicacion",
    title: "Ubicación",
    sortOrder: 20,
    body: URBANOVA_PILOT_CONTENT.locationDescription,
  },
  {
    slug: "contacto",
    title: "Contacto",
    sortOrder: 30,
    body: "Escríbenos para reservas, estadías prolongadas o preguntas sobre nuestras unidades en Laureles.",
  },
] as const;