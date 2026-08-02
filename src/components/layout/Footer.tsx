import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { NAV_LINKS, RESTAURANT, SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import { FacebookIcon, InstagramIcon } from "@/components/ui/SocialIcons";

export default function Footer() {
  return (
    <footer className="border-t border-gold-500/20 bg-green-950 text-cream/80">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:px-8 md:grid-cols-4">
        <div>
          <p className="font-display text-xl font-bold text-cream">{SITE_NAME}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em] text-gold-400">
            {SITE_TAGLINE}
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-cream/60">
            Authentic Afghan cuisine, traditional recipes, and warm
            hospitality — served with pride.
          </p>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold-400">
            Explore
          </p>
          <ul className="space-y-3 text-sm">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-gold-400">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold-400">
            Visit Us
          </p>
          <ul className="space-y-3 text-sm text-cream/70">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
              <span>
                {RESTAURANT.addressLine1}
                <br />
                {RESTAURANT.addressLine2}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-gold-400" />
              <a href={`tel:${RESTAURANT.phone}`}>{RESTAURANT.phone}</a>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-gold-400">
            Hours
          </p>
          <ul className="space-y-2 text-sm text-cream/70">
            {RESTAURANT.hours.map((h) => (
              <li key={h.day} className="flex justify-between gap-4">
                <span>{h.day}</span>
                <span>{h.hours}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex gap-3">
            <a
              href={RESTAURANT.social.instagram}
              aria-label="Instagram"
              className="rounded-full border border-cream/20 p-2 hover:border-gold-400 hover:text-gold-400"
            >
              <InstagramIcon className="h-4 w-4" />
            </a>
            <a
              href={RESTAURANT.social.facebook}
              aria-label="Facebook"
              className="rounded-full border border-cream/20 p-2 hover:border-gold-400 hover:text-gold-400"
            >
              <FacebookIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-cream/10 py-5 text-center text-xs text-cream/40">
        © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
      </div>
    </footer>
  );
}
