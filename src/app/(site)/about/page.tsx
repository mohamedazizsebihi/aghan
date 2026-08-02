import type { Metadata } from "next";
import Image from "next/image";
import { Handshake, Leaf, Sparkles } from "lucide-react";
import { RevealOnScroll } from "@/components/motion/RevealOnScroll";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export const metadata: Metadata = {
  title: "Our Story | Bagh-e-Kabul",
  description:
    "Discover the story behind Bagh-e-Kabul — authentic Afghan recipes, traditional hospitality, and a family legacy brought to your table.",
};

const values = [
  {
    icon: Leaf,
    title: "Traditional Recipes",
    description:
      "Every dish follows recipes passed down through generations — no shortcuts, no substitutes, just the way our grandmothers made them.",
  },
  {
    icon: Handshake,
    title: "Afghan Hospitality",
    description:
      "In Afghan culture, guests are treated like family. We bring that same warmth to every table, every order, every visit.",
  },
  {
    icon: Sparkles,
    title: "Quality Ingredients",
    description:
      "Fragrant spices, hand-selected rice, and fresh produce — sourced with care so every bite tastes like home.",
  },
];

export default function AboutPage() {
  return (
    <div className="bg-cream">
      <div className="relative overflow-hidden bg-green-950 py-24 text-center text-cream sm:py-32">
        <div className="relative mx-auto max-w-3xl px-6">
          <RevealOnScroll>
            <p className="text-xs uppercase tracking-[0.4em] text-gold-400">
              Our Story
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold sm:text-6xl">
              A Garden of Afghan Tradition
            </h1>
            <p className="mt-5 text-cream/70">
              Bagh-e-Kabul — &ldquo;The Garden of Kabul&rdquo; — is more than
              a name. It&rsquo;s a promise of the warmth, color, and flavor
              that define Afghan hospitality.
            </p>
          </RevealOnScroll>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <RevealOnScroll>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] shadow-xl">
              <Image
                src="/images/dishes/qabuli-palaw.png"
                alt="Traditional Qabuli Palaw"
                fill
                sizes="(min-width: 1024px) 520px, 90vw"
                className="object-cover"
              />
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15} className="flex flex-col justify-center">
            <Badge tone="burgundy">Since the Kitchen of Our Family</Badge>
            <h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">
              Where It All Began
            </h2>
            <p className="mt-5 leading-relaxed text-ink/70">
              Long before Bagh-e-Kabul had a dining room, it had a kitchen —
              filled with the smell of simmering qorma, fresh-baked naan,
              and rice steaming with saffron and raisins. Our founders grew
              up watching their mothers and grandmothers cook not from
              recipe cards, but from memory and love.
            </p>
            <p className="mt-4 leading-relaxed text-ink/70">
              When we opened our doors, we made one promise: every dish
              would taste exactly like it did back home. Today, we&rsquo;re
              proud to share that legacy with our community — one plate of
              Qabuli Palaw, one skewer of kebab, one cup of cardamom tea at
              a time.
            </p>
          </RevealOnScroll>
        </div>

        <div className="mt-24 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {values.map((value, i) => {
            const Icon = value.icon;
            return (
              <RevealOnScroll key={value.title} delay={i * 0.1}>
                <div className="h-full rounded-2xl bg-white/60 p-8 text-center ring-1 ring-ink/5">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-900/10 text-green-800">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 font-display text-xl font-semibold text-ink">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/60">
                    {value.description}
                  </p>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>

        <RevealOnScroll className="mt-24 text-center">
          <p className="mx-auto max-w-2xl font-display text-2xl italic text-ink/80 sm:text-3xl">
            &ldquo;A meal is never just food — it&rsquo;s an act of
            welcome.&rdquo;
          </p>
          <p className="mt-4 text-sm uppercase tracking-widest text-ink/40">
            An Afghan Proverb
          </p>
          <LinkButton href="/menu" size="lg" className="mt-10">
            Taste Our Menu
          </LinkButton>
        </RevealOnScroll>
      </div>
    </div>
  );
}
