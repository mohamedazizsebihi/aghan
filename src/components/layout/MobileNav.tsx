"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";

export default function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm md:hidden"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[80%] max-w-sm flex-col bg-green-950 px-6 py-6 shadow-2xl md:hidden"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-bold text-cream">
                {SITE_NAME}
              </span>
              <button
                aria-label="Close menu"
                onClick={onClose}
                className="rounded-full p-2 text-cream hover:bg-cream/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="mt-10 flex flex-col gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="font-display text-2xl text-cream/90 transition-colors hover:text-gold-400"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <Link
              href="/menu"
              onClick={onClose}
              className="mt-auto rounded-full bg-gold-500 px-6 py-3 text-center text-sm font-medium text-ink"
            >
              Order Now
            </Link>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
