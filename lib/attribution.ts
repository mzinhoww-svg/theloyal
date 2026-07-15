// Atribuicao de canal, first-touch, dependency-free. Le utm_* da URL na primeira
// visita e persiste em sessionStorage para sobreviver a navegacao ate o form.
// Sem cookie de terceiro, server-safe (no-op fora do browser). Responde "de que
// canal veio o assinante" (twitter, linkedin, ...), separado de qual form da
// pagina ele usou (o prop `source` do SubscribeForm).

export type Attribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

const KEY = "tl_attribution";
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;

function clean(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().slice(0, 60);
  return trimmed || undefined;
}

// Retorna a atribuicao de first-touch. Se ja capturada nesta sessao, mantem a
// original (o primeiro canal que trouxe a pessoa), sem sobrescrever em navegacao
// interna sem utm.
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Attribution;

    const params = new URLSearchParams(window.location.search);
    const attr: Attribution = {};
    for (const key of UTM_KEYS) {
      const val = clean(params.get(key));
      if (val) attr[key] = val;
    }

    // Persiste apenas quando houve algum utm, para nao gravar "{}" e travar
    // uma captura posterior.
    if (Object.keys(attr).length > 0) {
      window.sessionStorage.setItem(KEY, JSON.stringify(attr));
    }
    return attr;
  } catch {
    return {};
  }
}
