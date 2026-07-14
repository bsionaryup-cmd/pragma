import Link from "next/link";
import {
  getAdjacentArticles,
  getHelpArticle,
  HELP_ARTICLES,
  HELP_CATEGORIES,
  HELP_MANUAL_VERSION,
  searchHelpArticles,
  type HelpArticle,
} from "@/domains/retail/help/catalog";
import { HelpAnnotatedScreen } from "@/domains/retail/help/ui/help-annotated-screen";
import { TiendasOnPrimaryButton } from "@/domains/retail/ui/tiendas-on/controls";
import { TiendasOnScreen } from "@/domains/retail/ui/tiendas-on/screen-shell";

export function HelpCenterHome({ query = "" }: { query?: string }) {
  const results = searchHelpArticles(query);

  return (
    <TiendasOnScreen title="Centro de Ayuda" backHref="/intiendas/configuracion">
      <div className="space-y-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#d5dce6] bg-white p-4">
          <div>
            <p className="text-sm text-[#718096]">
              Documentación oficial de INTIENDAS · Manual v{HELP_MANUAL_VERSION}
            </p>
            <p className="mt-1 text-base font-semibold text-[#2d3748]">
              Busca por módulo, botón o acción
            </p>
          </div>
          <a href="/api/intiendas/ayuda/manual.pdf">
            <TiendasOnPrimaryButton type="button">Descargar Manual</TiendasOnPrimaryButton>
          </a>
        </div>

        <form className="flex gap-2" action="/intiendas/configuracion/ayuda" method="get">
          <input
            name="q"
            defaultValue={query}
            placeholder="Ej. caja, WhatsApp, contraseña…"
            className="h-11 flex-1 rounded-md border border-[#c5ced8] px-3 text-sm outline-none focus:border-pragma-electric"
          />
          <TiendasOnPrimaryButton type="submit">Buscar</TiendasOnPrimaryButton>
        </form>

        {query ? (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-[#2d3748]">
              Resultados ({results.length})
            </h2>
            <ArticleList articles={results} />
          </section>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {HELP_CATEGORIES.map((cat) => {
              const articles = HELP_ARTICLES.filter((a) => a.categoryId === cat.id);
              if (!articles.length) return null;
              return (
                <section
                  key={cat.id}
                  className="rounded-md border border-[#d5dce6] bg-white p-4 shadow-sm"
                >
                  <h2 className="text-base font-semibold text-[#2d3748]">{cat.title}</h2>
                  <p className="mt-1 text-sm text-[#718096]">{cat.description}</p>
                  <ul className="mt-3 space-y-1.5">
                    {articles.map((a) => (
                      <li key={a.slug}>
                        <Link
                          href={`/intiendas/configuracion/ayuda/${a.slug}`}
                          className="text-sm font-medium text-pragma-electric hover:underline"
                        >
                          {a.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <section className="rounded-md border border-[#d5dce6] bg-white p-4">
          <h2 className="text-base font-semibold">Índice completo</h2>
          <ArticleList articles={HELP_ARTICLES} />
        </section>
      </div>
    </TiendasOnScreen>
  );
}

function ArticleList({ articles }: { articles: HelpArticle[] }) {
  if (!articles.length) {
    return <p className="text-sm text-[#718096]">No hay artículos para esa búsqueda.</p>;
  }
  return (
    <ul className="mt-2 divide-y divide-[#edf2f7] rounded-md border border-[#e2e8f0]">
      {articles.map((a) => (
        <li key={a.slug}>
          <Link
            href={`/intiendas/configuracion/ayuda/${a.slug}`}
            className="block px-3 py-2.5 text-sm hover:bg-[#f8fafc]"
          >
            <span className="font-medium text-[#2d3748]">{a.title}</span>
            <span className="mt-0.5 block text-xs text-[#718096]">{a.objective}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function HelpArticleView({ article }: { article: HelpArticle }) {
  const { prev, next } = getAdjacentArticles(article.slug);
  const related = article.relatedSlugs
    .map((s) => getHelpArticle(s))
    .filter((a): a is HelpArticle => Boolean(a));

  return (
    <TiendasOnScreen title={article.title} backHref="/intiendas/configuracion/ayuda">
      <article className="mx-auto max-w-3xl space-y-6 p-4">
        <header className="space-y-2">
          {article.href ? (
            <p className="text-xs text-[#718096]">
              Pantalla:{" "}
              <Link href={article.href} className="text-pragma-electric hover:underline">
                {article.href}
              </Link>
            </p>
          ) : null}
          <p className="text-base text-[#4a5568]">{article.objective}</p>
        </header>

        <HelpAnnotatedScreen title={article.title} callouts={article.callouts} />

        <Section title="¿Para qué sirve?">{article.purpose}</Section>
        <Section title="¿Cuándo utilizarla?">{article.whenToUse}</Section>
        <Section title="Explicación general">{article.overview}</Section>

        <section>
          <h2 className="mb-2 text-lg font-semibold text-[#2d3748]">Pasos de uso</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-[#4a5568]">
            {article.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        {article.buttons.length ? (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Botones</h2>
            <ul className="space-y-2 text-sm">
              {article.buttons.map((b) => (
                <li key={b.name} className="rounded border border-[#e2e8f0] px-3 py-2">
                  <strong>{b.name}.</strong> {b.meaning}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {article.fields.length ? (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Campos</h2>
            <ul className="space-y-2 text-sm">
              {article.fields.map((f) => (
                <li key={f.name} className="rounded border border-[#e2e8f0] px-3 py-2">
                  <strong>{f.name}.</strong> {f.meaning}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Section title="Ejemplo práctico">{article.example}</Section>

        {article.tips.length ? <Callout tone="tip" title="Consejos" items={article.tips} /> : null}
        {article.warnings.length ? (
          <Callout tone="warn" title="Advertencias" items={article.warnings} />
        ) : null}
        {article.commonErrors.length ? (
          <Callout tone="err" title="Errores frecuentes" items={article.commonErrors} />
        ) : null}

        {related.length ? (
          <section>
            <h2 className="mb-2 text-lg font-semibold">Artículos relacionados</h2>
            <ul className="flex flex-wrap gap-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/intiendas/configuracion/ayuda/${r.slug}`}
                    className="inline-flex rounded-md border border-[#c5ced8] bg-white px-3 py-1.5 text-sm text-pragma-electric hover:border-pragma-electric"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e2e8f0] pt-4">
          {prev ? (
            <Link
              href={`/intiendas/configuracion/ayuda/${prev.slug}`}
              className="text-sm text-pragma-electric hover:underline"
            >
              ← {prev.title}
            </Link>
          ) : (
            <span />
          )}
          <Link href="/intiendas/configuracion/ayuda" className="text-sm text-[#718096] hover:underline">
            Volver al índice
          </Link>
          {next ? (
            <Link
              href={`/intiendas/configuracion/ayuda/${next.slug}`}
              className="text-sm text-pragma-electric hover:underline"
            >
              {next.title} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
    </TiendasOnScreen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold text-[#2d3748]">{title}</h2>
      <p className="text-sm leading-relaxed text-[#4a5568]">{children}</p>
    </section>
  );
}

function Callout({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "tip" | "warn" | "err";
}) {
  const cls =
    tone === "tip"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-950"
        : "border-red-200 bg-red-50 text-red-900";
  return (
    <section className={`rounded-md border px-4 py-3 ${cls}`}>
      <h2 className="mb-1 text-sm font-semibold">{title}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
