"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  UtensilsCrossed,
  FolderTree,
  QrCode,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";
import { LogoutButton } from "@/components/admin/LogoutButton";

const links = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/dishes", label: "Dishes", icon: UtensilsCrossed },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/tables", label: "Table QR Codes", icon: QrCode },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const content = (
    <div className="flex h-full flex-col bg-green-950 px-4 py-6 text-cream">
      <div className="px-2">
        <p className="font-display text-lg font-bold">{SITE_NAME}</p>
        <p className="text-xs uppercase tracking-widest text-gold-400">Admin</p>
      </div>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const Icon = link.icon;
          const active =
            link.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-gold-500 text-ink"
                  : "text-cream/70 hover:bg-cream/10 hover:text-cream"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-cream/10 pt-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-cream/70 transition-colors hover:bg-cream/10 hover:text-cream"
        >
          <ExternalLink className="h-4 w-4" />
          View Site
        </Link>
        <LogoutButton />
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden w-64 shrink-0 lg:block">
        <div className="fixed h-screen w-64">{content}</div>
      </div>

      <div className="flex items-center justify-between border-b border-ink/10 bg-green-950 px-5 py-4 text-cream lg:hidden">
        <p className="font-display text-lg font-bold">{SITE_NAME} Admin</p>
        <button onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 z-10 text-cream"
            >
              <X className="h-5 w-5" />
            </button>
            {content}
          </div>
        </div>
      )}
    </>
  );
}
