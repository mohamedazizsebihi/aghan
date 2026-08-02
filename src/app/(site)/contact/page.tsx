import type { Metadata } from "next";
import { Clock, MapPin, Phone, Mail } from "lucide-react";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { FacebookIcon, InstagramIcon } from "@/components/ui/SocialIcons";
import { RESTAURANT, SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Contact | Bagh-e-Kabul",
  description:
    "Visit Bagh-e-Kabul — find our address, opening hours, phone number, and directions.",
};

export default function ContactPage() {
  return (
    <div className="bg-cream">
      <div className="bg-green-950 py-20 text-center text-cream sm:py-24">
        <RevealOnScroll>
          <p className="text-xs uppercase tracking-[0.4em] text-gold-400">
            Get in Touch
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold sm:text-5xl">
            Visit {SITE_NAME}
          </h1>
        </RevealOnScroll>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <RevealOnScroll className="space-y-6">
            <InfoCard icon={MapPin} title="Address">
              {RESTAURANT.addressLine1}
              <br />
              {RESTAURANT.addressLine2}
            </InfoCard>
            <InfoCard icon={Phone} title="Phone">
              <a href={`tel:${RESTAURANT.phone}`} className="hover:text-burgundy-700">
                {RESTAURANT.phone}
              </a>
            </InfoCard>
            <InfoCard icon={Mail} title="Email">
              <a
                href={`mailto:${RESTAURANT.email}`}
                className="hover:text-burgundy-700"
              >
                {RESTAURANT.email}
              </a>
            </InfoCard>
            <InfoCard icon={Clock} title="Hours">
              <div className="space-y-1">
                {RESTAURANT.hours.map((h) => (
                  <p key={h.day} className="flex justify-between gap-6">
                    <span>{h.day}</span>
                    <span>{h.hours}</span>
                  </p>
                ))}
              </div>
            </InfoCard>

            <div className="flex gap-3 pt-2">
              <a
                href={RESTAURANT.social.instagram}
                aria-label="Instagram"
                className="rounded-full border border-ink/15 p-3 text-ink/60 hover:border-burgundy-700 hover:text-burgundy-700"
              >
                <InstagramIcon className="h-5 w-5" />
              </a>
              <a
                href={RESTAURANT.social.facebook}
                aria-label="Facebook"
                className="rounded-full border border-ink/15 p-3 text-ink/60 hover:border-burgundy-700 hover:text-burgundy-700"
              >
                <FacebookIcon className="h-5 w-5" />
              </a>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15}>
            <div className="h-[420px] w-full overflow-hidden rounded-[2rem] shadow-xl ring-1 ring-ink/5 lg:h-full">
              <iframe
                title="Restaurant location map"
                src={RESTAURANT.mapEmbedSrc}
                className="h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 rounded-2xl bg-white/60 p-6 ring-1 ring-ink/5">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-900/10 text-green-800">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-ink/50">
          {title}
        </p>
        <div className="mt-1 text-ink/80">{children}</div>
      </div>
    </div>
  );
}
