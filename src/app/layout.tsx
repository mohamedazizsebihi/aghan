import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bagh-e-Kabul | Le Jardin de Kaboul — Authentic Afghan Restaurant",
  description:
    "Bagh-e-Kabul brings authentic Afghan cuisine to your table — traditional recipes, warm hospitality, and a premium dining experience. Explore our menu and order online for delivery or pickup.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-ink">
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <Toaster
          position="bottom-center"
          theme="light"
          toastOptions={{
            style: {
              background: "var(--color-ink)",
              color: "var(--color-cream)",
              border: "1px solid var(--color-gold-600)",
            },
          }}
        />
      </body>
    </html>
  );
}
