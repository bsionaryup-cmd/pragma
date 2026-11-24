"use client";

import { WebSiteStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  archiveWebPageAction,
  createWebMediaAction,
  createWebPageAction,
  deleteWebPageAction,
  importFromPropertiesAction,
  importWebMediaJsonAction,
  importWebMediaZipAction,
  loadWebBuilderHubAction,
  reorderWebMediaAction,
  setWebMediaHeroAction,
  setWebMediaPropertyCoverAction,
  setWebSiteStatusAction,
  updateSitePropertyLinkAction,
  updateWebPageAction,
  updateWebSiteAction,
  type WebBuilderHubMedia,
  type WebBuilderHubSite,
} from "@/features/web-builder/actions/web-builder.actions";
import { parseHostProfile } from "@/lib/web-builder/host-profile";
import { isProtectedHomePageSlug } from "@/lib/web-builder/protected-home-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "overview", label: "Sitio web" },
  { id: "design", label: "Diseño" },
  { id: "pages", label: "Páginas" },
  { id: "lodging", label: "Alojamientos" },
  { id: "content", label: "Contenido" },
  { id: "import", label: "Importar" },
  { id: "booking", label: "Reservas" },
  { id: "config", label: "Configuración" },
  { id: "seo", label: "SEO" },
  { id: "publish", label: "Publicación" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const NEW_MEDIA_CATEGORIES = [
  { value: "GALLERY", label: "Galería" },
  { value: "HERO", label: "Hero" },
  { value: "LOCATION", label: "Ubicación" },
  { value: "PROPERTY", label: "Alojamiento" },
  { value: "OTHER", label: "Otra" },
] as const;

type NewMediaCategory = (typeof NEW_MEDIA_CATEGORIES)[number]["value"];

/** "cita | nombre" per line -> testimonials (blank/invalid lines dropped). */
function parseTestimonialLines(
  raw: string,
): Array<{ quote: string; guestName: string }> {
  return raw
    .split("\n")
    .flatMap((line) => {
      const idx = line.lastIndexOf("|");
      if (idx < 0) return [];
      const quote = line.slice(0, idx).trim();
      const guestName = line.slice(idx + 1).trim();
      return quote && guestName ? [{ quote, guestName }] : [];
    })
    .slice(0, 6);
}

type WebBuilderHubProps = {
  initialSite: WebBuilderHubSite;
  initialMedia: WebBuilderHubMedia;
  canManage: boolean;
};

export function WebBuilderHub({
  initialSite,
  initialMedia,
  canManage,
}: WebBuilderHubProps) {
  const router = useRouter();
  const [site, setSite] = useState(initialSite);
  const [media, setMedia] = useState(initialMedia);
  const [section, setSection] = useState<SectionId>("overview");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const previewHref = useMemo(
  () => `/w/${site.slug}/preview`,
  [site.slug],
  );

  const publicHref = useMemo(() => `/w/${site.slug}`, [site.slug]);

  const pilotSlugHref =
    site.slug === "urbanovaloft" ? "/urbanovaloft" : null;

  async function refreshHub() {
    const result = await loadWebBuilderHubAction();
    if (result.ok) {
      setSite(result.data.site);
      setMedia(result.data.media);
    }
  }

  function runSave(
    payload: Record<string, unknown>,
    success = "Cambios guardados",
  ) {
    if (!canManage) return;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await updateWebSiteAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(success);
      await refreshHub();
      router.refresh();
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HubPageHeader site={site} />

      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 md:px-6">
        {SECTIONS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={section === item.id ? "default" : "outline"}
            className="rounded-sm text-xs"
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {message ? (
          <p className="mb-3 text-sm text-emerald-700">{message}</p>
        ) : null}
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        {section === "overview" ? (
          <OverviewSection
            site={site}
            publicHref={publicHref}
            previewHref={previewHref}
            pilotSlugHref={pilotSlugHref}
          />
        ) : null}

        {section === "design" ? (
          <DesignSection site={site} canManage={canManage} pending={pending} onSave={runSave} />
        ) : null}

        {section === "pages" ? (
          <PagesSection
            site={site}
            canManage={canManage}
            pending={pending}
            onRefresh={refreshHub}
            onError={setError}
            onMessage={setMessage}
          />
        ) : null}

        {section === "lodging" ? (
          <LodgingSection
            site={site}
            canManage={canManage}
            pending={pending}
            onRefresh={refreshHub}
            onError={setError}
          />
        ) : null}

        {section === "content" ? (
          <ContentSection
            site={site}
            media={media}
            canManage={canManage}
            pending={pending}
            onSave={runSave}
            onRefresh={refreshHub}
            onError={setError}
            onMessage={setMessage}
          />
        ) : null}

        {section === "import" ? (
          <ImportSection
            canManage={canManage}
            pending={pending}
            onImported={async (summary) => {
              await refreshHub();
              setMessage(summary);
            }}
            onError={setError}
          />
        ) : null}

        {section === "booking" ? (
          <BookingSection
            site={site}
            canManage={canManage}
            pending={pending}
            onSave={runSave}
          />
        ) : null}

        {section === "config" ? (
          <ConfigSection site={site} canManage={canManage} pending={pending} onSave={runSave} />
        ) : null}

        {section === "seo" ? (
          <SeoSection site={site} canManage={canManage} pending={pending} onSave={runSave} />
        ) : null}

        {section === "publish" ? (
          <PublishSection
            site={site}
            canManage={canManage}
            pending={pending}
            onStatus={async (status) => {
              if (!canManage) return;
              const result = await setWebSiteStatusAction({ status });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setMessage(`Estado: ${result.data.status}`);
              await refreshHub();
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function pageStatusLabel(status: WebSiteStatus): string {
  switch (status) {
    case WebSiteStatus.DRAFT:
      return "Borrador";
    case WebSiteStatus.PUBLISHED:
      return "Publicada";
    default:
      return status;
  }
}

function PageStatusBadge({ status }: { status: WebSiteStatus }) {
  const label = pageStatusLabel(status);
  return (
    <Badge
      variant={status === WebSiteStatus.PUBLISHED ? "default" : "secondary"}
      className="text-[10px] uppercase tracking-wide"
    >
      {label}
    </Badge>
  );
}

function HubPageHeader({ site }: { site: WebBuilderHubSite }) {
  return (
    <HubHeaderRoot>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Web Builder</h1>
        <p className="text-sm text-muted-foreground">
          Sitio público · {site.siteName}
        </p>
      </div>
      <Badge variant="secondary">{site.status}</Badge>
    </HubHeaderRoot>
  );
}

function HubHeaderRoot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-5 md:px-6">
      {children}
    </div>
  );
}

function OverviewSection({
  site,
  publicHref,
  previewHref,
  pilotSlugHref,
}: {
  site: WebBuilderHubSite;
  publicHref: string;
  previewHref: string;
  pilotSlugHref: string | null;
}) {
  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Slug: <span className="font-mono text-foreground">{site.slug}</span>
      </p>
      <ReadonlyField label="Estado" value={site.status} />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="rounded-sm">
          <Link href={previewHref} target="_blank">
            Vista previa
          </Link>
        </Button>
        {site.status === WebSiteStatus.PUBLISHED ? (
          <Button asChild size="sm" className="rounded-sm">
            <Link href={publicHref} target="_blank">
              Sitio publicado
            </Link>
          </Button>
        ) : null}
        {pilotSlugHref ? (
          <Button asChild variant="secondary" size="sm" className="rounded-sm">
            <Link href={pilotSlugHref} target="_blank">
              /urbanovaloft
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function DesignSection({
  site,
  canManage,
  pending,
  onSave,
}: {
  site: WebBuilderHubSite;
  canManage: boolean;
  pending: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [logoUrl, setLogoUrl] = useState(site.logoUrl ?? "");
  const [primaryColor, setPrimary] = useState(site.primaryColor);
  const [accentColor, setAccent] = useState(site.accentColor);
  const [softWhite, setSoftWhite] = useState(site.softWhite);
  const [sandOak, setSandOak] = useState(site.sandOak);
  const [urbanGray, setUrbanGray] = useState(site.urbanGray);
  const [stoneTaupe, setStoneTaupe] = useState(site.stoneTaupe);
  const [matteBlack, setMatteBlack] = useState(site.matteBlack);
  const [fontFamily, setFont] = useState(site.fontFamily);

  function applyUrbanBoutiquePreset() {
    setPrimary("#1F1F1F");
    setAccent("#6E7862");
    setSoftWhite("#F6F4F1");
    setSandOak("#D8C7AE");
    setUrbanGray("#7C7A78");
    setStoneTaupe("#8B7E72");
    setMatteBlack("#1F1F1F");
    setFont("montserrat-poppins");
  }

  return (
    <SectionForm
      title="Diseño y estilos"
      onSubmit={() =>
        onSave({
          logoUrl: logoUrl || null,
          primaryColor,
          accentColor,
          softWhite,
          sandOak,
          urbanGray,
          stoneTaupe,
          matteBlack,
          fontFamily,
        })
      }
      canManage={canManage}
      pending={pending}
    >
      <p className="text-sm text-muted-foreground">
        La plantilla <span className="font-medium text-foreground">URBAN BOUTIQUE</span>{" "}
        está pensada para el diseño editorial tipo URBA NOVA (hero redondeado, buscador
        pill, tarjetas loft y ubicación split). Ajusta la paleta o aplica el preset.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canManage || pending}
          onClick={applyUrbanBoutiquePreset}
        >
          Aplicar identidad Urban Boutique
        </Button>
      </div>
      <Field label="Logo URL" value={logoUrl} onChange={setLogoUrl} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Primario (Matte Black)" value={primaryColor} onChange={setPrimary} />
        <Field label="Acento (Olive)" value={accentColor} onChange={setAccent} />
        <Field label="Soft White" value={softWhite} onChange={setSoftWhite} />
        <Field label="Sand Oak" value={sandOak} onChange={setSandOak} />
        <Field label="Urban Gray" value={urbanGray} onChange={setUrbanGray} />
        <Field label="Stone Taupe" value={stoneTaupe} onChange={setStoneTaupe} />
        <Field label="Matte Black" value={matteBlack} onChange={setMatteBlack} />
        <Field label="Tipografía (token)" value={fontFamily} onChange={setFont} />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        {[
          softWhite,
          sandOak,
          urbanGray,
          stoneTaupe,
          matteBlack,
          accentColor,
        ].map((hex) => (
          <span
            key={hex}
            className="h-8 w-8 rounded-md border border-border shadow-sm"
            style={{ backgroundColor: hex }}
            title={hex}
          />
        ))}
      </div>
    </SectionForm>
  );
}

function PagesSection({
  site,
  canManage,
  pending,
  onRefresh,
  onError,
  onMessage,
}: {
  site: WebBuilderHubSite;
  canManage: boolean;
  pending: boolean;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}) {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftSlug, setDraftSlug] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSort, setEditSort] = useState("0");
  const [editVisible, setEditVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    const result = await createWebPageAction({
      title: draftTitle,
      slug: draftSlug,
      body: draftBody || null,
      sortOrder: site.pages.length * 10,
      isVisible: true,
    });
    setBusy(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setDraftTitle("");
    setDraftSlug("");
    setDraftBody("");
    onMessage("Página creada");
    await onRefresh();
  }

  async function handleSaveEdit(pageId: string) {
    if (!canManage) return;
    setBusy(true);
    const result = await updateWebPageAction({
      pageId,
      title: editTitle,
      slug: editSlug,
      body: editBody || null,
      sortOrder: Number(editSort) || 0,
      isVisible: editVisible,
    });
    setBusy(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    setEditingId(null);
    onMessage("Página actualizada");
    await onRefresh();
  }

  async function handleTogglePublish(pageId: string, publish: boolean) {
    if (!canManage) return;
    setBusy(true);
    const result = await updateWebPageAction({
      pageId,
      status: publish ? WebSiteStatus.PUBLISHED : WebSiteStatus.DRAFT,
    });
    setBusy(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    onMessage(publish ? "Página publicada" : "Página en borrador");
    await onRefresh();
  }

  async function handleArchive(pageId: string) {
    if (!canManage) return;
    setBusy(true);
    const result = await archiveWebPageAction({ pageId });
    setBusy(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    onMessage("Página archivada (oculta y en borrador)");
    await onRefresh();
  }

  async function handleDelete(pageId: string) {
    if (!canManage) return;
    setBusy(true);
    const result = await deleteWebPageAction({ pageId });
    setBusy(false);
    if (!result.ok) {
      onError(result.error);
      return;
    }
    onMessage(
      result.data.archived ? "Página archivada (sitio publicado)" : "Página eliminada",
    );
    await onRefresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <HubListBlock title="Páginas del sitio">
        <p className="mb-3 text-sm text-muted-foreground">
          Gestión sencilla de páginas (título, slug, texto, orden y visibilidad).
          No es un editor visual.
        </p>
        <ul className="space-y-3">
          {site.pages.map((page) => (
            <li key={page.id} className="rounded-md border border-border p-3">
              {editingId === page.id ? (
                <div className="space-y-2">
                  <Field label="Título" value={editTitle} onChange={setEditTitle} />
                  <Field label="Slug" value={editSlug} onChange={setEditSlug} />
                  <label className="block space-y-1 text-sm">
                    <span className="text-muted-foreground">Contenido</span>
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={4}
                    />
                  </label>
                  <Field
                    label="Orden"
                    value={editSort}
                    onChange={setEditSort}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editVisible}
                      onChange={(e) => setEditVisible(e.target.checked)}
                    />
                    Visible
                  </label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canManage || busy || pending}
                      onClick={() => void handleSaveEdit(page.id)}
                    >
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{page.title}</p>
                      <PageStatusBadge status={page.status} />
                      {isProtectedHomePageSlug(page.slug) ? (
                        <Badge variant="outline" className="text-[10px]">
                          Inicio
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      /{page.slug} · orden {page.sortOrder}
                      {page.isVisible ? "" : " · oculta"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {page.status === WebSiteStatus.DRAFT ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={!canManage || busy || pending}
                        onClick={() => void handleTogglePublish(page.id, true)}
                      >
                        Publicar
                      </Button>
                    ) : page.status === WebSiteStatus.PUBLISHED ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canManage || busy || pending}
                        onClick={() => void handleTogglePublish(page.id, false)}
                      >
                        Pasar a borrador
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canManage}
                      onClick={() => {
                        setEditingId(page.id);
                        setEditTitle(page.title);
                        setEditSlug(page.slug);
                        setEditBody(page.body ?? "");
                        setEditSort(String(page.sortOrder));
                        setEditVisible(page.isVisible);
                      }}
                    >
                      Editar
                    </Button>
                    {isProtectedHomePageSlug(page.slug) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!canManage || busy}
                        onClick={() => void handleArchive(page.id)}
                      >
                        Archivar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={!canManage || busy}
                        onClick={() => void handleDelete(page.id)}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </HubListBlock>

      <form onSubmit={handleCreate} className="space-y-3 rounded-md border border-border p-4">
        <h3 className="text-sm font-semibold">Nueva página</h3>
        <Field label="Título" value={draftTitle} onChange={setDraftTitle} />
        <Field label="Slug" value={draftSlug} onChange={setDraftSlug} />
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Contenido</span>
          <Textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            rows={3}
          />
        </label>
        <Button
          type="submit"
          size="sm"
          disabled={!canManage || busy || pending || !draftTitle || !draftSlug}
        >
          Crear página
        </Button>
      </form>
    </div>
  );
}

function LodgingSection({
  site,
  canManage,
  pending,
  onRefresh,
  onError,
}: {
  site: WebBuilderHubSite;
  canManage: boolean;
  pending: boolean;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  return (
    <HubListBlock title="Alojamientos publicados">
      <ul className="space-y-4">
        {site.propertyLinks.map((link) => (
          <li key={link.id} className="rounded-md border border-border p-4">
            <p className="font-medium">{link.property.name}</p>
            <p className="text-xs text-muted-foreground">
              Orden {link.sortOrder}
              {link.customCoverUrl ? " · portada personalizada" : ""}
            </p>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={!canManage}
                defaultChecked={link.isPublished}
                onChange={(e) => {
                  if (!canManage) return;
                  void (async () => {
                    await updateSitePropertyLinkAction({
                      linkId: link.id,
                      isPublished: e.target.checked,
                    });
                    await onRefresh();
                  })();
                }}
              />
              Publicado en web
            </label>
            <TextRow
              label="Título"
              defaultValue={link.customTitle ?? ""}
              disabled={!canManage || pending}
              onBlur={(value) => {
                if (!canManage) return;
                void updateSitePropertyLinkAction({
                  linkId: link.id,
                  customTitle: value || null,
                });
              }}
            />
            <TextRow
              label="Descripción"
              defaultValue={link.customDescription ?? ""}
              disabled={!canManage || pending}
              multiline
              onBlur={(value) => {
                if (!canManage) return;
                void updateSitePropertyLinkAction({
                  linkId: link.id,
                  customDescription: value || null,
                });
              }}
            />
            <TextRow
              label="Portada (URL)"
              defaultValue={link.customCoverUrl ?? ""}
              disabled={!canManage || pending}
              onBlur={(value) => {
                if (!canManage) return;
                void (async () => {
                  const result = await updateSitePropertyLinkAction({
                    linkId: link.id,
                    customCoverUrl: value || null,
                  });
                  if (!result.ok) onError(result.error);
                  else await onRefresh();
                })();
              }}
            />
            <TextRow
              label="Orden en listado"
              defaultValue={String(link.sortOrder)}
              disabled={!canManage || pending}
              onBlur={(value) => {
                if (!canManage) return;
                const sortOrder = Number.parseInt(value, 10);
                if (!Number.isFinite(sortOrder)) return;
                void (async () => {
                  const result = await updateSitePropertyLinkAction({
                    linkId: link.id,
                    sortOrder,
                  });
                  if (!result.ok) onError(result.error);
                  else await onRefresh();
                })();
              }}
            />
          </li>
        ))}
      </ul>
    </HubListBlock>
  );
}

function ContentSection({
  site,
  media,
  canManage,
  pending,
  onSave,
  onRefresh,
  onError,
  onMessage,
}: {
  site: WebBuilderHubSite;
  media: WebBuilderHubMedia;
  canManage: boolean;
  pending: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}) {
  const [heroTitle, setHeroTitle] = useState(site.heroTitle ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(site.heroSubtitle ?? "");
  const [heroImageUrl, setHeroImage] = useState(site.heroImageUrl ?? "");
  const [locationDescription, setLocationDescription] = useState(
    site.locationDescription ?? "",
  );
  const initialHost = parseHostProfile(site.hostProfile);
  const [aboutText, setAboutText] = useState(site.aboutText ?? "");
  const [hostName, setHostName] = useState(initialHost?.hostName ?? "");
  const [hostPhotoUrl, setHostPhotoUrl] = useState(initialHost?.hostPhotoUrl ?? "");
  const [hostBio, setHostBio] = useState(initialHost?.hostBio ?? "");
  const [hostExperience, setHostExperience] = useState(
    initialHost?.hostExperience ?? "",
  );
  const [hostRating, setHostRating] = useState(
    initialHost?.hostRating != null ? String(initialHost.hostRating) : "",
  );
  const [hostReviewCount, setHostReviewCount] = useState(
    initialHost?.hostReviewCount != null ? String(initialHost.hostReviewCount) : "",
  );
  const [hostTestimonials, setHostTestimonials] = useState(
    (initialHost?.hostTestimonials ?? [])
      .map((item) => `${item.quote} | ${item.guestName}`)
      .join("\n"),
  );
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaCategory, setNewMediaCategory] =
    useState<NewMediaCategory>("GALLERY");
  const [coverLinkId, setCoverLinkId] = useState(
    site.propertyLinks[0]?.id ?? "",
  );

  return (
    <div className="space-y-8">
      <SectionForm
        title="Hero y ubicación"
        onSubmit={() =>
          onSave({
            heroTitle: heroTitle || null,
            heroSubtitle: heroSubtitle || null,
            heroImageUrl: heroImageUrl || null,
            locationDescription: locationDescription || null,
          })
        }
        canManage={canManage}
        pending={pending}
      >
        <Field label="Título hero" value={heroTitle} onChange={setHeroTitle} />
        <TextAreaField
          label="Subtítulo"
          value={heroSubtitle}
          onChange={setHeroSubtitle}
        />
        <Field label="Imagen hero (URL)" value={heroImageUrl} onChange={setHeroImage} />
        <TextAreaField
          label="Descripción ubicación"
          value={locationDescription}
          onChange={setLocationDescription}
        />
      </SectionForm>

      <SectionForm
        title="Anfitrión y sobre nosotros"
        onSubmit={() => {
          const ratingValue = Number.parseFloat(hostRating.replace(",", "."));
          const reviewCountValue = Number.parseInt(hostReviewCount, 10);
          onSave({
            aboutText: aboutText || null,
            hostProfile: {
              hostName: hostName || null,
              hostPhotoUrl: hostPhotoUrl || null,
              hostBio: hostBio || null,
              hostExperience: hostExperience || null,
              hostRating: Number.isFinite(ratingValue) ? ratingValue : null,
              hostReviewCount: Number.isFinite(reviewCountValue)
                ? reviewCountValue
                : null,
              hostTestimonials: parseTestimonialLines(hostTestimonials),
            },
          });
        }}
        canManage={canManage}
        pending={pending}
      >
        <TextAreaField
          label="Sobre nosotros (texto general)"
          value={aboutText}
          onChange={setAboutText}
        />
        <Field label="Nombre del anfitrión" value={hostName} onChange={setHostName} />
        <Field
          label="Foto del anfitrión (URL)"
          value={hostPhotoUrl}
          onChange={setHostPhotoUrl}
        />
        <TextAreaField
          label="Mensaje de bienvenida / bio"
          value={hostBio}
          onChange={setHostBio}
        />
        <Field
          label="Experiencia (ej. 5 años recibiendo huéspedes)"
          value={hostExperience}
          onChange={setHostExperience}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Calificación (0-5, opcional)"
            value={hostRating}
            onChange={setHostRating}
          />
          <Field
            label="Número de reseñas (opcional)"
            value={hostReviewCount}
            onChange={setHostReviewCount}
          />
        </div>
        <TextAreaField
          label="Testimonios reales (uno por línea: cita | nombre del huésped)"
          value={hostTestimonials}
          onChange={setHostTestimonials}
        />
        <p className="text-xs text-muted-foreground">
          Si dejas todo vacío, la sección del anfitrión no se muestra. Usa solo
          testimonios reales y autorizados.
        </p>
      </SectionForm>

      <HubListBlock title="Fotografías">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="https://..."
            value={newMediaUrl}
            disabled={!canManage}
            onChange={(e) => setNewMediaUrl(e.target.value)}
            className="rounded-sm"
          />
          <select
            aria-label="Categoría de la foto"
            className="h-9 rounded-sm border border-input bg-background px-2 text-sm"
            disabled={!canManage}
            value={newMediaCategory}
            onChange={(e) => setNewMediaCategory(e.target.value as NewMediaCategory)}
          >
            {NEW_MEDIA_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={!canManage || !newMediaUrl}
            className="rounded-sm"
            onClick={() => {
              void (async () => {
                const result = await createWebMediaAction({
                  url: newMediaUrl,
                  category: newMediaCategory,
                });
                if (!result.ok) {
                  onError(result.error);
                  return;
                }
                setNewMediaUrl("");
                onMessage("Medio agregado");
                await onRefresh();
              })();
            }}
          >
            Agregar URL
          </Button>
        </div>
        {site.propertyLinks.length > 0 ? (
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Label className="shrink-0 text-xs">Alojamiento (portada)</Label>
            <select
              className="h-9 flex-1 rounded-sm border border-input bg-background px-2 text-sm"
              disabled={!canManage}
              value={coverLinkId}
              onChange={(e) => setCoverLinkId(e.target.value)}
            >
              {site.propertyLinks.map((link) => (
                <option key={link.id} value={link.id}>
                  {link.customTitle ?? link.property.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <ul className="space-y-2 text-sm text-muted-foreground">
          {media.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-2 rounded-md border border-border/60 p-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1 truncate">
                <span className="font-medium text-foreground">{row.category}</span>
                {" · orden "}
                {row.sortOrder}
                <br />
                <span className="truncate text-xs">{row.url}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="number"
                  className="h-8 w-20 rounded-sm"
                  defaultValue={row.sortOrder}
                  disabled={!canManage}
                  onBlur={(e) => {
                    const sortOrder = Number.parseInt(e.target.value, 10);
                    if (!Number.isFinite(sortOrder)) return;
                    void (async () => {
                      const result = await reorderWebMediaAction({
                        updates: [{ id: row.id, sortOrder }],
                      });
                      if (!result.ok) onError(result.error);
                      else await onRefresh();
                    })();
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-sm"
                  disabled={!canManage}
                  onClick={() => {
                    void (async () => {
                      const result = await setWebMediaHeroAction({ mediaId: row.id });
                      if (!result.ok) onError(result.error);
                      else {
                        onMessage("Imagen asignada al hero");
                        await onRefresh();
                      }
                    })();
                  }}
                >
                  Hero
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-sm"
                  disabled={!canManage || !coverLinkId}
                  onClick={() => {
                    void (async () => {
                      const result = await setWebMediaPropertyCoverAction({
                        mediaId: row.id,
                        propertyLinkId: coverLinkId,
                      });
                      if (!result.ok) onError(result.error);
                      else {
                        onMessage("Portada de alojamiento actualizada");
                        await onRefresh();
                      }
                    })();
                  }}
                >
                  Portada
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </HubListBlock>
    </div>
  );
}

function ImportSection({
  canManage,
  pending,
  onImported,
  onError,
}: {
  canManage: boolean;
  pending: boolean;
  onImported: (summary: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [manifestJson, setManifestJson] = useState(
    '[\n  { "url": "https://example.com/foto-1.jpg", "sortOrder": 0 }\n]',
  );
  const [zipBusy, setZipBusy] = useState(false);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Importa portadas desde propiedades activas y sincroniza enlaces del sitio.
        </p>
        <Button
          type="button"
          disabled={!canManage || pending}
          className="rounded-sm"
          onClick={() => {
            void (async () => {
              const result = await importFromPropertiesAction();
              if (!result.ok) {
                onError(result.error);
                return;
              }
              await onImported(`Importadas ${result.data.imported} entradas desde PMS`);
            })();
          }}
        >
          Importar desde propiedades
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border p-4">
        <p className="text-sm font-medium">JSON de URLs (sin binarios en Postgres)</p>
        <Textarea
          className="min-h-[120px] rounded-sm font-mono text-xs"
          value={manifestJson}
          disabled={!canManage}
          onChange={(e) => setManifestJson(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          disabled={!canManage || pending}
          className="rounded-sm"
          onClick={() => {
            void (async () => {
              let items: unknown;
              try {
                items = JSON.parse(manifestJson) as unknown;
              } catch {
                onError("JSON inválido");
                return;
              }
              const payload = Array.isArray(items)
                ? { items }
                : (items as { items?: unknown });
              const result = await importWebMediaJsonAction(payload);
              if (!result.ok) {
                onError(result.error);
                return;
              }
              await onImported(
                `JSON: ${result.data.created} creados, ${result.data.skippedDuplicates} duplicados omitidos`,
              );
            })();
          }}
        >
          Importar manifest JSON
        </Button>
      </div>

      <div className="space-y-2 rounded-md border border-border p-4">
        <p className="text-sm font-medium">ZIP de imágenes</p>
        <p className="text-xs text-muted-foreground">
          Incluye <code className="text-[11px]">manifest.json</code> con URLs, o imágenes
          sueltas (requiere S3: WEB_BUILDER_S3_BUCKET, AWS credenciales y{" "}
          <code className="text-[11px]">jszip</code>).
        </p>
        <Input
          type="file"
          accept=".zip,application/zip"
          disabled={!canManage || zipBusy}
          className="rounded-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file || !canManage) return;
            void (async () => {
              setZipBusy(true);
              try {
                const formData = new FormData();
                formData.set("file", file);
                const result = await importWebMediaZipAction(formData);
                if (!result.ok) {
                  onError(result.error);
                  return;
                }
                const parts = [
                  `ZIP: ${result.data.created} creados`,
                  result.data.skippedDuplicates
                    ? `${result.data.skippedDuplicates} duplicados`
                    : null,
                  result.data.pendingStorage
                    ? `${result.data.pendingStorage} pendientes de S3`
                    : null,
                  result.data.storageReason,
                ].filter(Boolean);
                await onImported(parts.join(" · "));
              } finally {
                setZipBusy(false);
                e.target.value = "";
              }
            })();
          }}
        />
      </div>
    </div>
  );
}

function BookingSection({
  site,
  canManage,
  pending,
  onSave,
}: {
  site: WebBuilderHubSite;
  canManage: boolean;
  pending: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [enabled, setEnabled] = useState(site.bookingEnabled);
  return (
    <SectionForm
      title="Reservas web"
      onSubmit={() => onSave({ bookingEnabled: enabled })}
      canManage={canManage}
      pending={pending}
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!canManage}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Motor de reservas habilitado
      </label>
    </SectionForm>
  );
}

function ConfigSection({
  site,
  canManage,
  pending,
  onSave,
}: {
  site: WebBuilderHubSite;
  canManage: boolean;
  pending: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [slug, setSlug] = useState(site.slug);
  const [contactEmail, setEmail] = useState(site.contactEmail ?? "");
  const [whatsapp, setWhatsapp] = useState(site.whatsapp ?? "");
  const [instagramUrl, setInstagram] = useState(site.instagramUrl ?? "");
  const [facebookUrl, setFacebook] = useState(site.facebookUrl ?? "");

  return (
    <SectionForm
      title="Configuración"
      onSubmit={() =>
        onSave({
          slug,
          contactEmail: contactEmail || null,
          whatsapp: whatsapp || null,
          instagramUrl: instagramUrl || null,
          facebookUrl: facebookUrl || null,
        })
      }
      canManage={canManage}
      pending={pending}
    >
      <Field label="Slug público" value={slug} onChange={setSlug} />
      <Field label="Email contacto" value={contactEmail} onChange={setEmail} />
      <Field label="WhatsApp" value={whatsapp} onChange={setWhatsapp} />
      <Field label="Instagram URL" value={instagramUrl} onChange={setInstagram} />
      <Field label="Facebook URL" value={facebookUrl} onChange={setFacebook} />
    </SectionForm>
  );
}

function SeoSection({
  site,
  canManage,
  pending,
  onSave,
}: {
  site: WebBuilderHubSite;
  canManage: boolean;
  pending: boolean;
  onSave: (payload: Record<string, unknown>) => void;
}) {
  const [seoTitle, setTitle] = useState(site.seoTitle ?? "");
  const [seoDescription, setDesc] = useState(site.seoDescription ?? "");
  const [canonical, setCanonical] = useState(site.seoCanonicalUrl ?? "");
  const [ogImageUrl, setOg] = useState(site.ogImageUrl ?? "");

  return (
    <SectionForm
      title="SEO"
      onSubmit={() =>
        onSave({
          seoTitle: seoTitle || null,
          seoDescription: seoDescription || null,
          seoCanonicalUrl: canonical || null,
          ogImageUrl: ogImageUrl || null,
        })
      }
      canManage={canManage}
      pending={pending}
    >
      <Field label="Meta título" value={seoTitle} onChange={setTitle} />
      <TextAreaField label="Meta descripción" value={seoDescription} onChange={setDesc} />
      <Field label="Canonical URL" value={canonical} onChange={setCanonical} />
      <Field label="OG image URL" value={ogImageUrl} onChange={setOg} />
    </SectionForm>
  );
}

function PublishSection({
  site,
  canManage,
  pending,
  onStatus,
}: {
  site: WebBuilderHubSite;
  canManage: boolean;
  pending: boolean;
  onStatus: (status: WebSiteStatus) => Promise<void>;
}) {
  const statuses: WebSiteStatus[] = [
    WebSiteStatus.DRAFT,
    WebSiteStatus.IN_REVIEW,
    WebSiteStatus.PUBLISHED,
    WebSiteStatus.UNPUBLISHED,
  ];

  return (
    <HubListBlock title="Publicación">
      <p className="mb-4 text-sm text-muted-foreground">
        Estado actual: <strong>{site.status}</strong>
      </p>
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <Button
            key={status}
            type="button"
            size="sm"
            disabled={!canManage || pending}
            variant={site.status === status ? "default" : "outline"}
            className="rounded-sm"
            onClick={() => void onStatus(status)}
          >
            {status}
          </Button>
        ))}
      </div>
    </HubListBlock>
  );
}

function SectionForm({
  title,
  children,
  onSubmit,
  canManage,
  pending,
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  canManage: boolean;
  pending: boolean;
}) {
  return (
    <form
      className="max-w-xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
      <Button type="submit" disabled={!canManage || pending} className="rounded-sm">
        Guardar
      </Button>
    </form>
  );
}

function HubListBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl space-y-2">
      <h2 className="text-lg font-medium">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm"
      />
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm"
        rows={3}
      />
    </div>
  );
}

function TextRow({
  label,
  defaultValue,
  disabled,
  multiline,
  onBlur,
}: {
  label: string;
  defaultValue: string;
  disabled: boolean;
  multiline?: boolean;
  onBlur: (value: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className={cn("mt-2 space-y-1", multiline ? "" : "")}>
      <Label className="text-xs">{label}</Label>
      {multiline ? (
        <Textarea
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onBlur(value)}
          className="rounded-sm"
          rows={2}
        />
      ) : (
        <Input
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => onBlur(value)}
          className="rounded-sm"
        />
      )}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}