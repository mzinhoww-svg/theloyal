// Aplicação dos overrides do operador (forecast_overrides) às séries do
// Predict. Puro e sem dependência de servidor — testável direto via
// type-stripping (tests/predict-overrides.test.mjs).
//
// A tabela é a MESMA do Forecast: silenciar uma série numa área silencia na
// outra. Só pin/mute se aplicam aqui — override de CONFIANÇA é ignorado de
// propósito: a confiança do Predict nasce de CV + backtest e sobrescrevê-la
// quebraria a leitura do hazard.

export type OverrideScope = "route" | "cluster";

export interface OverrideLike {
  scope: OverrideScope | string;
  route: string;
  action: string; // "pin" | "mute" | "confidence"
  note?: string | null;
}

export interface SeriesLike {
  scope: OverrideScope | string;
  origem: string | null;
  destino: string;
}

// Chave no formato do Forecast: "origem→destino" (route) ou "→destino" (cluster).
export function overrideRouteKey(s: SeriesLike): string {
  return s.origem ? `${s.origem}→${s.destino}` : `→${s.destino}`;
}

export const overrideKey = (scope: string, route: string) => `${scope}:${route.trim()}`;

export type WithOverrides<T> = T & {
  pinned: boolean;
  muted: boolean;
  overrideNote: string | null;
};

// Decora e reordena: fixados primeiro, silenciados por último, ordem original
// preservada dentro de cada grupo (mesma regra do Forecast).
export function applyPredictOverrides<T extends SeriesLike>(
  list: T[],
  overrides: OverrideLike[],
): WithOverrides<T>[] {
  const byKey = new Map<string, OverrideLike>();
  for (const o of overrides) {
    if (o.action === "pin" || o.action === "mute") byKey.set(overrideKey(o.scope, o.route), o);
  }
  const views = list.map((s) => {
    const o = byKey.get(overrideKey(s.scope, overrideRouteKey(s)));
    return {
      ...s,
      pinned: o?.action === "pin",
      muted: o?.action === "mute",
      overrideNote: o?.note ?? null,
    };
  });
  return views.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.muted !== b.muted) return a.muted ? 1 : -1;
    return 0;
  });
}
