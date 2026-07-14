import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "The Loyal · Entrar",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next?.startsWith("/admin") ? searchParams.next : "/admin";
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-ink font-display text-sm font-bold text-paper">
            TL
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg font-semibold">
              Central de Controle
            </div>
            <div className="text-xs text-gray-500">acesso restrito</div>
          </div>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
