import type { Metadata } from "next";
import { Sidebar, MobileNav } from "@/components/admin/Sidebar";
import { LiveRefresh } from "@/components/admin/LiveRefresh";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { ToastProvider } from "@/components/admin/toast";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { StatusDot } from "@/components/admin/ui";
import { adminConfigured } from "@/lib/admin-db";
import { logout } from "@/app/admin/login/actions";

export const metadata: Metadata = {
  title: "The Loyal · Central de Controle",
  robots: { index: false, follow: false },
};

// Todo o painel é dinâmico: lê dados ao vivo do Supabase a cada request.
export const dynamic = "force-dynamic";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = adminConfigured();
  const renderedAt = new Date().toISOString();

  return (
    <ToastProvider>
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
            <div className="mt-auto flex flex-col gap-3 px-1">
              <form action={logout}>
                <SubmitButton variant="default" pendingLabel="Saindo…">
                  Sair
                </SubmitButton>
              </form>
              <p className="text-[11px] leading-snug text-gray-500">
                Guardrail factual ativo. Conferência humana no Beehiiv.
              </p>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-2.5">
              <div className="flex items-center gap-3">
                <a href="/admin" className="flex items-center gap-2 md:hidden">
                  <span className="flex h-7 w-7 items-center justify-center rounded bg-ink font-display text-xs font-bold text-paper">
                    TL
                  </span>
                  <span className="text-sm font-semibold">Central</span>
                </a>
                <CommandPalette />
                <span
                  className="hidden items-center gap-1.5 text-xs text-gray-500 md:inline-flex"
                  title={
                    configured
                      ? "Lendo e operando dados ao vivo do Supabase."
                      : "Sem SUPABASE_SERVICE_ROLE_KEY — painel em modo mock."
                  }
                >
                  <StatusDot tone={configured ? "green" : "yellow"} />
                  {configured ? "Supabase" : "modo mock"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <LiveRefresh renderedAt={renderedAt} />
                <form action={logout} className="md:hidden">
                  <SubmitButton variant="default">Sair</SubmitButton>
                </form>
              </div>
            </header>
            <MobileNav />

            <main id="conteudo" className="min-w-0 flex-1 px-5 py-6 lg:px-8">
              {!configured && (
                <div className="mb-5 rounded-lg border border-line bg-yellow-100 px-4 py-3 text-sm text-ink">
                  <strong className="font-semibold">
                    Sem conexão com o Supabase.
                  </strong>{" "}
                  Defina{" "}
                  <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> no
                  ambiente para o painel ler e operar os dados.
                </div>
              )}
              {children}
            </main>
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
