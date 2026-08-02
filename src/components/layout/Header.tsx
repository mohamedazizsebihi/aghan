"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, ShoppingBag } from "lucide-react";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";
import { useCartStore } from "@/store/cart-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import CartDrawer from "@/components/cart/CartDrawer";
import MobileNav from "@/components/layout/MobileNav";

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hydrated = useHydrated();
  const totalItems = useCartStore((s) => s.totalItems());
  const openCart = useCartStore((s) => s.open);

  // Close the mobile menu when navigating. Adjusting during render rather
  // than from an effect means the menu is already closed in the frame that
  // shows the new route, instead of flashing open for one paint.
  const [navigatedFrom, setNavigatedFrom] = useState(pathname);
  if (pathname !== navigatedFrom) {
    setNavigatedFrom(pathname);
    setMobileOpen(false);
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gold-500/20 bg-green-950/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="group flex flex-col leading-none">
            <span className="font-display text-xl font-bold tracking-wide text-cream sm:text-2xl">
              {SITE_NAME}
            </span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-gold-400 sm:text-xs">
              Le Jardin de Kaboul
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative text-sm font-medium tracking-wide text-cream/80 transition-colors hover:text-gold-400",
                  pathname === link.href && "text-gold-400"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/menu"
              className="hidden rounded-full bg-gold-500 px-5 py-2 text-sm font-medium text-ink transition-colors hover:bg-gold-400 sm:inline-flex"
            >
              Order Now
            </Link>
            <button
              aria-label="Open cart"
              onClick={openCart}
              className="relative rounded-full p-2 text-cream transition-colors hover:bg-cream/10"
            >
              <ShoppingBag className="h-5 w-5" />
              <AnimatePresence>
                {hydrated && totalItems > 0 && (
                  <motion.span
                    key={totalItems}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-burgundy-700 px-1 text-[11px] font-semibold text-cream"
                  >
                    {totalItems}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="rounded-full p-2 text-cream transition-colors hover:bg-cream/10 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <MobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <CartDrawer />
    </>
  );
}
