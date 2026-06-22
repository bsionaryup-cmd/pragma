export type PublicSearchLink = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export function buildPublicSearchQuery(searchQuery: string, city: string): string {
  const query = searchQuery.trim();
  const cityPart = city.trim();
  if (!cityPart) return query;
  if (!query) return cityPart;
  return `${query} ${cityPart}`;
}

export function buildPublicSearchLinks(searchQuery: string, city: string): PublicSearchLink[] {
  const combined = buildPublicSearchQuery(searchQuery, city);
  const encoded = encodeURIComponent(combined || "administración de propiedades Colombia");

  return [
    {
      id: "google-maps",
      label: "Google Maps",
      description: "Empresas locales con ficha pública",
      href: `https://www.google.com/maps/search/${encoded}`,
    },
    {
      id: "google-web",
      label: "Google",
      description: "Resultados web públicos",
      href: `https://www.google.com/search?q=${encoded}`,
    },
    {
      id: "instagram",
      label: "Instagram",
      description: "Perfiles y hashtags públicos",
      href: `https://www.instagram.com/explore/search/keyword/?q=${encoded}`,
    },
    {
      id: "paginas-amarillas",
      label: "Páginas Amarillas",
      description: "Directorio empresarial Colombia",
      href: `https://www.paginasamarillas.com.co/busqueda/${encoded.replace(/%20/g, "-")}`,
    },
  ];
}
