import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.theloyal.com.br"),
  title: "The Loyal | Pontos e milhas sem pegadinha",
  description:
    "A gente faz a conta das promoções de pontos, milhas e cashback e diz, em reais, se vale a pena. E-mail grátis de 5 minutos, todo dia útil às 8h.",
  openGraph: {
    title: "The Loyal | Pontos e milhas sem pegadinha",
    description:
      "A gente faz a conta das promoções de pontos, milhas e cashback e diz, em reais, se vale a pena. E-mail grátis de 5 minutos, todo dia útil às 8h.",
    type: "website",
    locale: "pt_BR",
  },
  // Card grande no X/Twitter: a imagem OG (app/opengraph-image.tsx) e reaproveitada
  // pelo Next como imagem do card. Essencial para o alcance no compartilhamento.
  twitter: {
    card: "summary_large_image",
    title: "The Loyal | Pontos e milhas sem pegadinha",
    description:
      "A gente faz a conta das promoções de pontos, milhas e cashback e diz, em reais, se vale a pena. E-mail grátis de 5 minutos, todo dia útil às 8h.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${fraunces.variable} ${inter.variable} ${jetbrains.variable}`}
      >
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded focus:bg-ink focus:px-4 focus:py-2 focus:font-semibold focus:text-paper"
        >
          Pular para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}
