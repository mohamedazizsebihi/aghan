"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Printer, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useHydrated } from "@/hooks/use-hydrated";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  isLoopbackUrl,
  isValidBaseUrl,
  resolveQrBaseUrl,
  tableMenuUrl,
} from "@/lib/table-qr";

/**
 * Prints one QR code per table.
 *
 * The set of codes comes from the tables that actually exist, not from a
 * quantity typed here — printing a code for a table the checkout would refuse
 * is how a customer ends up scanning something that silently does nothing.
 * Inactive tables are excluded for the same reason.
 */
export function TableQrCodes({
  tableNumbers,
  envBaseUrl,
}: {
  tableNumbers: number[];
  envBaseUrl?: string;
}) {
  // Empty string is a meaningful state here (the admin cleared the field to
  // retype it), so "untouched" has to be null rather than "".
  const [editedBaseUrl, setEditedBaseUrl] = useState<string | null>(null);

  /**
   * `window.location.origin` is the single most reliable answer (see
   * resolveQrBaseUrl) but the server render can't know it. Reading it only once
   * hydrated keeps the two renders in agreement instead of tripping a mismatch.
   */
  const hydrated = useHydrated();
  const detectedBaseUrl = resolveQrBaseUrl(
    envBaseUrl,
    hydrated ? window.location.origin : null
  );

  const baseUrl = editedBaseUrl ?? detectedBaseUrl;
  const valid = isValidBaseUrl(baseUrl);
  const unreachable = valid && isLoopbackUrl(baseUrl);

  /**
   * Which single table to print, or null for the whole set. Only the print
   * stylesheet reads this, so the screen never changes as a result.
   */
  const [printTarget, setPrintTarget] = useState<number | null>(null);

  /**
   * `afterprint` rather than a reset straight after `window.print()`: the call
   * blocks until the dialog closes in today's browsers, but that isn't
   * guaranteed, and clearing the target too early would print the whole sheet
   * when the owner asked for one table.
   */
  useEffect(() => {
    const clear = () => setPrintTarget(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  /**
   * The class that narrows the sheet has to be in the DOM *before* the print
   * dialog snapshots the page, and React batches state updates — hence
   * flushSync, which is exactly the "DOM must be up to date for a synchronous
   * browser API" case it exists for.
   */
  function print(target: number | null) {
    flushSync(() => setPrintTarget(target));
    window.print();
  }

  return (
    <div>
      <div className="no-print space-y-6">
        <div className="grid gap-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink/5 sm:grid-cols-[1fr_auto] sm:p-6">
          <div>
            <label
              htmlFor="qr-base-url"
              className="text-xs font-medium uppercase tracking-wider text-ink/50"
            >
              Menu address
            </label>
            <input
              id="qr-base-url"
              value={baseUrl}
              onChange={(e) => setEditedBaseUrl(e.target.value)}
              spellCheck={false}
              className="input mt-2 font-mono text-xs sm:text-sm"
              placeholder="http://192.168.1.11:3000"
            />
            <p className="mt-2 text-xs text-ink/45">
              {editedBaseUrl === null
                ? "Detected automatically from how you're viewing this page."
                : "Edited manually."}{" "}
              Codes link to <span className="font-mono">{baseUrl}/menu</span>.
            </p>
          </div>

          <div className="sm:w-44">
            <p className="text-xs font-medium uppercase tracking-wider text-ink/50">
              Codes to print
            </p>
            <p className="mt-2 font-display text-2xl font-bold text-ink">
              {tableNumbers.length}
            </p>
            <p className="mt-1 text-xs text-ink/45">
              One per active table. Manage them above.
            </p>
          </div>
        </div>

        {!valid && (
          <p className="rounded-xl bg-burgundy-800/10 px-4 py-3 text-sm text-burgundy-800">
            That isn&apos;t a valid web address — it needs to start with{" "}
            <span className="font-mono">http://</span> or{" "}
            <span className="font-mono">https://</span>.
          </p>
        )}

        {unreachable && (
          <div className="flex gap-3 rounded-xl bg-gold-500/15 px-4 py-3 text-sm text-brown-800">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
            <p>
              <span className="font-medium">
                These codes won&apos;t work on a phone.
              </span>{" "}
              <span className="font-mono">{baseUrl}</span> points a phone back at
              itself. Use the address other devices reach this server on — the
              LAN address (e.g.{" "}
              <span className="font-mono">http://192.168.1.11:3000</span>) or your
              domain.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => print(null)}
            disabled={!valid || tableNumbers.length === 0}
            variant="secondary"
            size="sm"
          >
            <Printer className="h-4 w-4" />
            Print all {tableNumbers.length}{" "}
            {tableNumbers.length === 1 ? "code" : "codes"}
          </Button>
          <p className="text-sm text-ink/45">
            …or print one table on its own from its card below.
          </p>

          {editedBaseUrl !== null && (
            <button
              onClick={() => setEditedBaseUrl(null)}
              className="inline-flex items-center gap-2 text-sm text-ink/50 transition-colors hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to detected address
            </button>
          )}
        </div>
      </div>

      {/*
        Only this subtree survives printing — see the @media print block in
        globals.css. Its grid is overridden there for paper.
      */}
      <div
        className={cn(
          "qr-print-sheet mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
          printTarget !== null && "is-single-print"
        )}
      >
        {valid &&
          tableNumbers.map((tableNumber) => {
            const url = tableMenuUrl(baseUrl, tableNumber);
            return (
              <figure
                key={tableNumber}
                className={cn(
                  "qr-card flex flex-col items-center rounded-2xl border-2 border-gold-500 bg-white px-5 py-6 text-center",
                  printTarget === tableNumber && "is-print-target"
                )}
              >
                <figcaption className="order-first">
                  <p className="font-display text-lg font-bold text-green-950">
                    {SITE_NAME}
                  </p>
                  <p className="text-[0.6rem] uppercase tracking-[0.2em] text-gold-700">
                    {SITE_TAGLINE}
                  </p>
                </figcaption>

                <div className="qr-code my-5 rounded-lg bg-white p-2">
                  <QRCodeSVG
                    value={url}
                    size={148}
                    level="M"
                    marginSize={0}
                    bgColor="#ffffff"
                    fgColor="#241b14"
                    title={`Menu QR code for table ${tableNumber}`}
                  />
                </div>

                <p className="font-display text-2xl font-bold text-ink">
                  Table {tableNumber}
                </p>
                <p className="mt-1 text-xs text-ink/60">
                  Scan to view our menu
                </p>

                <button
                  onClick={() => print(tableNumber)}
                  className="no-print mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print this one
                </button>
              </figure>
            );
          })}
      </div>
    </div>
  );
}
