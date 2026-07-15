// Seed idempotente do Radar de VPM (Fase 4) — catálogo (§6), fontes (§7) e
// observações históricas validadas (§8). Fonte de verdade: os arrays abaixo.
//   node scripts/shopping/seed.mjs --emit-sql   → imprime SQL idempotente (stdout)
//   node scripts/shopping/seed.mjs              → upsert via Supabase REST (service key)
// Os dados de 2026-07-14 são HISTÓRICOS (não coleta atual). Nunca sobrescrevem
// observações; re-executar não duplica (guardas ON CONFLICT / NOT EXISTS).
import { existsSync, readFileSync } from "node:fs";

const HIST_AT = "2026-07-14T12:00:00-04:00";
const HIST_ADAPTER = "historical_seed_v1";
const CALC_VERSION = "shopping_vpm_v1";

// ---------- §6 catálogo ----------
const PRODUCTS = [
  ["jbl|jblpbclub120br|preta", "audio", "JBL PartyBox Club 120", "JBL", "JBLPBCLUB120BR", "Preta 160W bateria 12h", "high", 3],
  ["jbl|jblpbstage320br|preta", "audio", "JBL PartyBox Stage 320", "JBL", "JBLPBSTAGE320BR", "Preta 240W", "high", 3],
  ["jbl|jblpartybox720br|preta", "audio", "JBL PartyBox 720", "JBL", "JBLPARTYBOX720BR", "Preta 800W", "high", 3],
  ["jbl|partybox710|preta", "audio", "JBL PartyBox 710", "JBL", "PARTYBOX710", "Preta 800W", "medium", 3],
  ["jbl|jblpartyboxultbr|preta", "audio", "JBL PartyBox Ultimate", "JBL", "JBLPARTYBOXULTBR", "Preta 1100W Wi-Fi Dolby Atmos", "high", 3],
  ["jbl|boombox3wifi|preta", "audio", "JBL Boombox 3 Wi-Fi", "JBL", "BOOMBOX3WIFI", "Preta Wi-Fi IP67 200W", "high", 3],
  ["jbl|jblboombox4blkbr|preta", "audio", "JBL Boombox 4", "JBL", "JBLBOOMBOX4BLKBR", "Preta 210W", "high", 3],
  ["jbl|xtreme4|azul", "audio", "JBL Xtreme 4", "JBL", "XTREME4", "Azul IP67", "high", 3],
  ["jbl|jblcharge6blkbr|preta", "audio", "JBL Charge 6", "JBL", "JBLCHARGE6BLKBR", "Preta 40W IP68", "high", 3],
  ["jbl|jblflip7blkbr|preta", "audio", "JBL Flip 7", "JBL", "JBLFLIP7BLKBR", "Preta 35W IP68", "high", 3],
  ["jbl|jblflip7whtbr|branca", "audio", "JBL Flip 7", "JBL", "JBLFLIP7WHTBR", "Branca 35W IP68", "high", 3],
  ["jbl|go4|azul", "audio", "JBL GO 4", "JBL", "GO4", "Azul 4.2W IP67", "medium", 3],
  ["jbl|jbl-es2blkbr|azul", "audio", "JBL Go Essential 2", "JBL", "JBL ES2BLKBR", "Azul 3.1W", "medium", 3],
  ["jbl|jblpbencore22micbr|preta", "audio", "JBL PartyBox Encore 2", "JBL", "JBLPBENCORE22MICBR", "Preta 100W com 2 microfones", "high", 3],
  ["philips-walita|na130-00|6.2l|220v", "small_appliances", "Air Fryer Philips Walita Série 1000 XL 6.2L", "Philips Walita", "NA130/00", "Preta 6.2L 1700W 220V", "high", 3],
  ["nespresso|vertuo-next|kit", "coffee_machines", "Nespresso Vertuo Next com Kit Boas Vindas", "Nespresso", "Vertuo Next", "Vermelho ou preto com kit", "high", 3],
  ["nespresso|d30|vermelha|110v|kit", "coffee_machines", "Nespresso Essenza Mini D30 com Kit Boas Vindas", "Nespresso", "D30", "Vermelha 110V com kit", "high", 3],
  ["samsung|galaxy-a55-5g|256gb", "smartphones", "Samsung Galaxy A55 5G 256GB", "Samsung", "Galaxy A55 5G", "256GB 8GB RAM", "high", 3],
  ["samsung|galaxy-a56-5g|128gb", "smartphones", "Samsung Galaxy A56 5G 128GB", "Samsung", "Galaxy A56 5G", "128GB 8GB RAM", "medium", 2],
  ["samsung|qn55q7faagxzd|55", "tv_video", "Smart TV Samsung QLED 55 4K", "Samsung", "QN55Q7FAAGXZD", "55 polegadas QLED 60Hz", "high", 3],
  ["lg|55qned73asa|55", "tv_video", "Smart TV LG QNED 55 4K", "LG", "55QNED73ASA", "55 polegadas WebOS 25", "high", 3],
  ["tramontina|professional|30cm", "kitchen", "Frigideira Tramontina Professional 30 cm", "Tramontina", "Professional 30cm", "Alumínio 30cm", "medium", 3],
  ["tramontina|plenus|facas", "kitchen", "Jogo de Facas Tramontina Plenus", "Tramontina", "Plenus", "5 a 10 peças", "medium", 3],
  ["targus|tsb968|15.6", "computing", "Mochila Targus Intellect Advanced 15.6", "Targus", "TSB968", "Preta notebook 15.6", "medium", 2],
];

// ---------- §7 fontes (product|category) ----------
// [productKey, program, urlType, url, marketplaceSku?, partnerSku?]
const SOURCES = [
  ["jbl|boombox3wifi|preta", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/extra?codigoSku=63DBE720-5373-4307-8788-51CD391C38C8&tipo=ACUMULO", "72554056", "55064220"],
  ["jbl|boombox3wifi|preta", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/55064220/4764210/caixa-de-som-portatil-jbl-boombox-3-com-wi-fi-bluetooth-e-certificacao-ip67-resistente-a-agua-preta", "5018637", "55064220"],
  ["jbl|boombox3wifi|preta", "smiles", "product", "https://shoppingsmiles.com.br/magazineluiza/caixa-de-som-jbl-boombox-3-wifi-bluetooth-portatil-a-prova-de-agua-200w/2376846", "2376846", "2376846"],
  ["jbl|jblpbclub120br|preta", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/casasbahia/caixa-de-som-jbl-partybox-120-com-160w-rms/78585633", "86982951", "2383054"],
  ["jbl|jblpbclub120br|preta", "azul_fidelidade", "category", "https://shopping.azulfidelidade.com.br/categoria/11919/caixa-de-som-portatil?supplierCategory=5628", "86982951", null],
  ["jbl|jblpbclub120br|preta", "smiles", "category", "https://shoppingsmiles.com.br/magazineluiza/categoria/caixa-de-som-bluetooth-portatil-jbl/78D1417F-EF0A-4452-970F-228F817F3F29?tipo=RESGATE", "86982951", "2383054"],
  ["jbl|jblpbstage320br|preta", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/extra/caixa-de-som-jbl-partybox-320-bluetooth-240w-bateria-18h-preta/86982954/", null, null],
  ["jbl|jblpbstage320br|preta", "azul_fidelidade", "category", "https://shopping.azulfidelidade.com.br/categoria/11919/caixa-de-som-portatil?supplierCategory=5628", null, null],
  ["jbl|jblpbstage320br|preta", "smiles", "product", "https://shoppingsmiles.com.br/magazineluiza/caixa-de-som-jbl-partybox-stage-320-bluetooth-amplificada-portatil-ipx4-240w-usb/2383057", null, null],
  ["jbl|jblpartybox720br|preta", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/magazineluiza/caixa-de-som-jbl-partybox-720-bluetooth-amplificada-portatil-800w/2406930", null, null],
  ["jbl|jblpartybox720br|preta", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/55071806/5654425/caixa-de-som-jbl-partybox-720-800w-bluetooth-usb-ipx4-preta", null, null],
  ["jbl|jblpartybox720br|preta", "smiles", "category", "https://shoppingsmiles.com.br/magazineluiza/categoria/caixa-de-som-bluetooth-portatil-jbl/78D1417F-EF0A-4452-970F-228F817F3F29?tipo=RESGATE", null, null],
  ["jbl|partybox710|preta", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/extra/caixa-de-som-portatil-jbl-partybox-710/43963571/", null, null],
  ["jbl|partybox710|preta", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/SG2144/4436121/caixa-de-som-portatil-bluetooth-jbl-partybox-710", null, null],
  ["jbl|jblpartyboxultbr|preta", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/satelitalpontostore/caixa-de-som-jbl-partybox-ultimate-jblpartyboxultbr/SI3990", null, "JBLPARTYBOXULTBR"],
  ["jbl|jblpartyboxultbr|preta", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/si3990/5376028/caixa-de-som-jbl-partybox-ultimate-jblpartyboxultbr", "5394101", "SI3990"],
  ["jbl|jblpartyboxultbr|preta", "smiles", "category", "https://shoppingsmiles.com.br/magazineluiza/categoria/caixa-de-som-bluetooth-portatil-jbl/78D1417F-EF0A-4452-970F-228F817F3F29?tipo=RESGATE", "74938997", "JBLPARTYBOXULTBR"],
  ["jbl|jblboombox4blkbr|preta", "latam_pass", "category", "https://shopping.latampass.latam.com/pt_br/pontofrio/categoria/caixa-de-som-portatil/06aa5639-a0b7-4875-ae4d-fcbae59d9662?tipo=RESGATE", null, null],
  ["jbl|jblboombox4blkbr|preta", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/240451400/5610967/caixa-de-som-jbl-boombox-4-bluetooth-amplificada-portatil-210w-usb-c", null, null],
  ["jbl|xtreme4|azul", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/pontofrio/caixa-de-som-portatil-jbl-xtreme-4-azul/77722533/", null, null],
  ["jbl|xtreme4|azul", "smiles", "product", "https://shoppingsmiles.com.br/extra/caixa-de-som-portatil-jbl-xtreme-4-azul/77722533?tipo=RESGATE", null, null],
  ["jbl|jblcharge6blkbr|preta", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/casasbahia/caixa-de-som-jbl-charge-6-40w-bluetooth-ip68-preta/83865554", null, null],
  ["jbl|jblflip7blkbr|preta", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/extra/caixa-de-som-jbl-flip-7-preta-bivolt/83163398/", null, null],
  ["jbl|jblflip7whtbr|branca", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/55072302/5689268/caixa-de-som-portatil-jbl-flip-7-branca", null, null],
  ["jbl|jblflip7whtbr|branca", "smiles", "product", "https://shoppingsmiles.com.br/pontofrio/caixa-de-som-portatil-jbl-flip-7-branca/93427630", null, null],
  ["philips-walita|na130-00|6.2l|220v", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/magazineluiza/air-fryer-philips-walita-serie-1000-na13000-preta-62l/2404122?tipo=ACUMULO", null, null],
  ["philips-walita|na130-00|6.2l|220v", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/55067672/5363073/fritadeira-air-fryer-philips-walita-serie-1000-xl-na130-6-2l-preta-220v", null, null],
  ["philips-walita|na130-00|6.2l|220v", "smiles", "product", "https://shoppingsmiles.com.br/pontofrio/fritadeira-airfryer-philips-walita-serie-1000-xl-62l-1700w-preto/83962776", null, null],
  ["nespresso|vertuo-next|kit", "latam_pass", "category", "https://shopping.latampass.latam.com/pt_br/pontofrio/categoria/nespresso/aa2ebfad-2a37-44d7-9f47-bcef36cb5261?tipo=RESGATE", null, null],
  ["nespresso|vertuo-next|kit", "smiles", "category", "https://shoppingsmiles.com.br/magazineluiza/categoria/cafeteira-nespresso/AC8114BF-523C-4CBA-8C24-21E993882E4D?tipo=RESGATE", null, null],
  ["nespresso|d30|vermelha|110v|kit", "latam_pass", "category", "https://shopping.latampass.latam.com/pt_br/pontofrio/categoria/nespresso/aa2ebfad-2a37-44d7-9f47-bcef36cb5261?tipo=RESGATE", null, null],
  ["nespresso|d30|vermelha|110v|kit", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/55030976/3267393/cafeteira-nespresso-essenza-mini-d30-vermelha-110v", null, null],
  ["samsung|galaxy-a56-5g|128gb", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/extra/smartphone-samsung-galaxy-a56-5g-verde-128gb/82533794/", null, null],
  ["samsung|galaxy-a56-5g|128gb", "azul_fidelidade", "product", "https://shopping.azulfidelidade.com.br/produto/30994/240095600/5467376/smartphone-samsung-galaxy-a56-128gb-5g-preto", null, null],
  ["samsung|qn55q7faagxzd|55", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/magazineluiza/smart-tv-55-samsung-qled-qn55q7faagxzd/2401471/", null, null],
  ["samsung|qn55q7faagxzd|55", "azul_fidelidade", "category", "https://shopping.azulfidelidade.com.br/categoria/233217/tv/28", null, null],
  ["samsung|qn55q7faagxzd|55", "smiles", "product", "https://shoppingsmiles.com.br/extra/smart-tv-55-samsung-qled-4k-qn55q7faagxzd/83177365", null, null],
  ["lg|55qned73asa|55", "latam_pass", "category", "https://shopping.latampass.latam.com/pt_br/pontofrio/categoria/tv-4k/ACB9E353-B4A7-4799-BEFC-63C3C93D1B78?tipo=RESGATE", null, null],
  ["lg|55qned73asa|55", "azul_fidelidade", "category", "https://shopping.azulfidelidade.com.br/categoria/233217/tv/2", null, null],
  ["tramontina|professional|30cm", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/satelitaltramontina/frigideira-tramontina-professional-aluminio-30cm/SA5459", null, null],
  ["tramontina|plenus|facas", "latam_pass", "product", "https://shopping.latampass.latam.com/pt_br/magazineluiza/jogo-de-facas-tramontina-plenus/2233767", null, null],
];

// ---------- §8 observações históricas validadas ----------
// [productKey, program, partner, refPrice|null, std, elite|null, hybridPts|null, hybridCash|null, notes]
const OBS = [
  ["jbl|boombox3wifi|preta", "latam_pass", "Extra/Casas Bahia", 2609.91, 186329, 131236, 114832, 1013.28, "Menor resgate condicionado a Clube ou cartão"],
  ["jbl|boombox3wifi|preta", "azul_fidelidade", "Casas Bahia", null, 221592, 177274, 33239, 2395.9, "Preço integral não identificado na captura histórica"],
  ["jbl|boombox3wifi|preta", "smiles", "Magazine Luiza", 2799.0, 201528, 185406, null, null, "Mesmo modelo em parceiro diferente"],
  ["jbl|jblpbclub120br|preta", "latam_pass", "Casas Bahia/Magalu", 1889.1, 136498, 94992, 83118, 733.43, "Validar se a URL ainda corresponde à Club 120"],
  ["jbl|jblpbclub120br|preta", "azul_fidelidade", "Casas Bahia", null, 203761, 163009, 30565, 2203.11, "Validar EAN e SKU completo"],
  ["jbl|jblpbclub120br|preta", "smiles", "Magalu/Ponto Frio", 2049.0, 147528, 135726, null, null, "Mesmo modelo e potência"],
  ["jbl|jblpartyboxultbr|preta", "latam_pass", "Ponto Store", 7691.9, 615295, 386775, 338428, 2986.28, "MPN explícito"],
  ["jbl|jblpartyboxultbr|preta", "azul_fidelidade", "Top Store/Extra", null, 704619, null, 105693, 7618.48, "Preço integral não identificado"],
  ["jbl|jblpartyboxultbr|preta", "smiles", "Magalu/Extra", 7499.0, 539928, 496734, null, null, "Mesmo MPN e especificações"],
];

// ---------- SQL emit ----------
const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const n = (v) => (v == null || v === "" ? "null" : String(v));

function emitSql() {
  const L = [];
  L.push("-- Seed do Radar de VPM (gerado por scripts/shopping/seed.mjs). Idempotente.");
  L.push("-- Dados de 2026-07-14 são HISTÓRICOS (manual_reference), não coleta atual.\n");

  L.push("-- produtos");
  for (const [key, cat, name, brand, mpn, variant, match, cov] of PRODUCTS) {
    L.push(
      `insert into public.shopping_products (canonical_key,category_code,normalized_name,brand,mpn,variant_description,match_confidence,expected_program_coverage) values (${q(key)},${q(cat)},${q(name)},${q(brand)},${q(mpn)},${q(variant)},${q(match)},${n(cov)}) on conflict (canonical_key) do update set normalized_name=excluded.normalized_name, match_confidence=excluded.match_confidence, updated_at=now();`,
    );
  }
  L.push("\n-- fontes (product|category)");
  for (const [key, prog, type, url, msku, psku] of SOURCES) {
    const method = type === "product" ? "browser_headless" : "unknown";
    const status = type === "product" ? "pending_validation" : "pending_validation";
    L.push(
      `insert into public.shopping_product_sources (product_id,program_code,marketplace_sku,partner_sku,product_url,source_url_type,extraction_method,requires_browser,source_status) select p.id,${q(prog)},${q(msku)},${q(psku)},${q(url)},${q(type)},${q(method)},true,${q(status)} from public.shopping_products p where p.canonical_key=${q(key)} on conflict (product_id,program_code,product_url) do nothing;`,
    );
  }
  L.push("\n-- observações históricas validadas (§8) — guarda NOT EXISTS por (produto,programa,adapter)");
  for (const [key, prog, partner, price, std, elite, hpts, hcash, notes] of OBS) {
    L.push(
      `insert into public.shopping_observations (source_id,product_id,program_code,captured_at,partner_cash_price,reference_price,reference_price_type,reference_price_source,standard_points,elite_points,hybrid_points,hybrid_cash,availability,match_confidence,extraction_confidence,extraction_method,adapter_version,calculation_version,offer_condition_text,validation_status) ` +
        `select s.id,p.id,${q(prog)},${q(HIST_AT)}::timestamptz,${n(price)},${n(price)},'a_vista','historical_seed',${n(std)},${n(elite)},${n(hpts)},${n(hcash)},'in_stock','high','high','manual_reference',${q(HIST_ADAPTER)},${q(CALC_VERSION)},${q(notes)},'validated_historical' ` +
        `from public.shopping_products p join lateral (select id from public.shopping_product_sources ss where ss.product_id=p.id and ss.program_code=${q(prog)} order by (source_url_type='product') desc limit 1) s on true ` +
        `where p.canonical_key=${q(key)} and not exists (select 1 from public.shopping_observations o where o.product_id=p.id and o.program_code=${q(prog)} and o.adapter_version=${q(HIST_ADAPTER)});`,
    );
  }
  return L.join("\n") + "\n";
}

if (process.argv.includes("--emit-sql")) {
  process.stdout.write(emitSql());
} else {
  console.error("[seed] use --emit-sql para gerar SQL idempotente (aplicar via migração/psql).");
  console.error("[seed] (upsert direto via REST requer SUPABASE_SERVICE_KEY — não implementado neste modo)");
}

export { PRODUCTS, SOURCES, OBS, emitSql };
