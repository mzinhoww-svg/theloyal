import type { Metadata } from "next";
import { Sidebar } from "@/components/admin/Sidebar";
import { adminConfigured } from "@/lib/admin-db";

export const metadata: Metadata = {
  title: "The Loyal · Central de Controle",
  robots: { index: false, follow: false },
};

// Toda a Central de Controle e dinamica: le dados ao vivo do Supabase a cada
// request. Nunca deve ser pre-renderizada estaticamente.
export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = adminConfigured();
  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-[200px] flex-none flex-col gap-4 border-r border-line bg-surface px-3 py-4 md:flex">
          <a href="/admin" className="flex items-center gap-2 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded bg-ink font-display text-sm font-bold text-paper">
              TL
            </span>
            <span className="text-sm font-semibold leading-tight">
              Central de
              <br />
              Controle
            </span>
          </a>
          <Sidebar />
          <div className="mt-auto px-1 text-[11px] leading-snug text-gray-400">
            Guardrail factual ativo. Conferência humana no Beehiiv.
          </div>
        </aside>

        <main id="conteudo" className="min-w-0 flex-1 px-5 py-6 lg:px-8">
          {!configured && (
            <div className="mb-5 rounded-lg border border-line bg-yellow-100 px-4 py-3 text-sm text-ink">
              <strong className="font-semibold">Modo somente-leitura sem dados.</strong>{" "}
              Defina <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> no
              ambiente para o painel ler e operar o Supabase.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
