"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { LinkButton } from "@/components/ui/Button";
import { SITE_TAGLINE } from "@/lib/constants";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div
      ref={ref}
      className="relative flex h-[92vh] min-h-[620px] items-center overflow-hidden bg-green-950"
    >
      <motion.div style={{ y: bgY }} className="absolute inset-0 scale-[1.15]">
        <Image
          src="/images/desgine/hero-spread.png"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/60 via-green-950/10 to-green-950/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
      </motion.div>

      <FloatingMotifs />

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto max-w-4xl px-6 text-center"
      >
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-xs uppercase tracking-[0.5em] text-gold-400 sm:text-sm"
        >
          {SITE_TAGLINE}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 font-display text-5xl font-bold leading-[1.05] text-cream sm:text-6xl md:text-7xl"
        >
          Authentic Afghan
          <br />
          Flavors, Served with
          <br />
          <span className="text-gold-400">Warm Hospitality</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.45 }}
          className="mx-auto mt-6 max-w-xl text-base text-cream/75 sm:text-lg"
        >
          From sizzling kebabs to fragrant Qabuli Palaw — every dish is a
          recipe passed down through generations, made fresh for your table.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <LinkButton href="/menu" size="lg">
            View Menu
          </LinkButton>
          <LinkButton href="/checkout" variant="outline" size="lg">
            Order Now
          </LinkButton>
        </motion.div>
      </motion.div>
    </div>
  );
}

function FloatingMotifs() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] motion-reduce:hidden">
      <span className="absolute left-[10%] top-[22%] h-2 w-2 animate-[float_9s_ease-in-out_infinite] rounded-full bg-gold-400/60 blur-[1px]" />
      <span className="absolute right-[15%] top-[35%] h-3 w-3 animate-[float_11s_ease-in-out_infinite_1s] rounded-full bg-gold-400/40 blur-[1px]" />
      <span className="absolute bottom-[28%] left-[20%] h-1.5 w-1.5 animate-[float_7s_ease-in-out_infinite_0.5s] rounded-full bg-cream/50 blur-[1px]" />
      <span className="absolute bottom-[35%] right-[22%] h-2 w-2 animate-[float_10s_ease-in-out_infinite_2s] rounded-full bg-cream/40 blur-[1px]" />
    </div>
  );
}
