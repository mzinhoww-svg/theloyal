// Fonte das edições reais para o arquivo web (/edicao): a API do Beehiiv.
// Server-only — usa BEEHIIV_API_KEY (nunca no client). Sem credenciais, devolve
// lista vazia e a página mostra um empty state, sem quebrar.

export type PublishedEdition = {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  date: string; // ISO (YYYY-MM-DD) para exibição/ordenção
};

// URL pública da publicação (não é segredo) — fallback para montar o link
// quando a API não devolver web_url explícito.
const PUBLIC_BASE = "https://theloyal.beehiiv.com";

function toISODate(unixOrString: unknown): string {
  if (typeof unixOrString === "number") {
    return new Date(unixOrString * 1000).toISOString().slice(0, 10);
  }
  if (typeof unixOrString === "string" && unixOrString) {
    const d = new Date(unixOrString);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return "";
}

type RawPost = {
  id?: string;
  title?: string;
  subtitle?: string;
  slug?: string;
  web_url?: string;
  url?: string;
  status?: string;
  publish_date?: number | string;
  displayed_date?: number | string;
  created?: number | string;
};

export async function listPublishedEditions(): Promise<PublishedEdition[]> {
  const apiKey = process.env.BEEHIIV_API_KEY?.trim();
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID?.trim();
  if (!apiKey || !publicationId) return [];

  const pubId = publicationId.startsWith("pub_")
    ? publicationId
    : `pub_${publicationId}`;

  const url =
    `https://api.beehiiv.com/v2/publications/${pubId}/posts` +
    `?status=published&limit=100&order_by=publish_date&direction=desc`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      // ISR: revalida de hora em hora sem novo build.
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error("[edicoes] Beehiiv respondeu", res.status);
      return [];
    }
    const json = (await res.json()) as { data?: RawPost[] };
    const posts = Array.isArray(json.data) ? json.data : [];

    return posts
      .filter((p) => p.status === "published" && p.id && p.title)
      .map((p) => ({
        id: p.id as string,
        title: p.title as string,
        subtitle: p.subtitle || undefined,
        url:
          p.web_url ||
          p.url ||
          (p.slug ? `${PUBLIC_BASE}/p/${p.slug}` : PUBLIC_BASE),
        date: toISODate(p.publish_date ?? p.displayed_date ?? p.created),
      }))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  } catch (err) {
    console.error("[edicoes] falha ao buscar posts do Beehiiv", err);
    return [];
  }
}
