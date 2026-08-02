"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Power, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { clampTableCount, MAX_TABLE_COUNT } from "@/lib/table-qr";

export type TableRow = {
  id: string;
  number: number;
  isActive: boolean;
};

/**
 * Creates and manages the restaurant's tables — the list that decides which
 * table numbers a dine-in order may be placed for.
 *
 * Two ways in, one rule: a batch to get started, then one at a time. Both
 * *append* — numbers are never reissued and never renumbered, because a printed
 * QR code says "Table 3" and has to keep meaning the same table.
 */
export function TableManager({
  tables,
  highest,
}: {
  tables: TableRow[];
  /**
   * The highest number ever issued, which is NOT the highest in `tables`:
   * retired tables are hidden from this list but keep their number claimed, so
   * deriving it here would promise a next number the server will not hand out.
   */
  highest: number;
}) {
  const router = useRouter();
  // A string so the field can genuinely be empty while being retyped.
  const [batchInput, setBatchInput] = useState("");
  const [busy, setBusy] = useState(false);

  const roomLeft = MAX_TABLE_COUNT - highest;

  /**
   * `successMessage` is optional: creation only knows what to say once the
   * response names the numbers it made, so that caller reports for itself.
   * Passing a generic message here as well produced two stacked toasts.
   */
  async function send(url: string, init: RequestInit, successMessage?: string) {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      if (successMessage) toast.success(successMessage);
      router.refresh();
      return data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function describeCreated(created: number[]) {
    if (created.length === 1) return `Table ${created[0]} added`;
    return `Tables ${created[0]}–${created[created.length - 1]} added`;
  }

  async function addTables(count: number) {
    const data = await send("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count }),
    });
    if (data?.created) toast.success(describeCreated(data.created));
    return data;
  }

  async function submitBatch(e: React.FormEvent) {
    e.preventDefault();
    const count = clampTableCount(Number(batchInput));
    if (count === null) {
      toast.error("Enter how many tables to add.");
      return;
    }
    const data = await addTables(count);
    if (data) setBatchInput("");
  }

  return (
    <div className="space-y-6">
      {tables.length === 0 ? (
        <form
          onSubmit={submitBatch}
          className="rounded-2xl bg-white px-6 py-8 text-center shadow-sm ring-1 ring-ink/5"
        >
          <p className="font-display text-lg font-semibold text-ink">
            No tables yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink/50">
            Dine-in ordering is off until you add tables — a QR code can only be
            printed, and an order only accepted, for a table that exists here.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <input
              type="number"
              min={1}
              max={MAX_TABLE_COUNT}
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder="e.g. 4"
              aria-label="How many tables to create"
              className="input max-w-[7rem] text-center"
            />
            <Button type="submit" disabled={busy} size="sm">
              <Plus className="h-4 w-4" />
              Create tables
            </Button>
          </div>
        </form>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/5 px-5 py-3 sm:px-6">
            <div>
              <p className="text-sm font-medium text-ink">
                {tables.length} {tables.length === 1 ? "table" : "tables"}
              </p>
              <p className="text-xs text-ink/45">
                {tables.filter((t) => t.isActive).length} taking orders
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || roomLeft < 1}
                onClick={() => addTables(1)}
              >
                <Plus className="h-4 w-4" />
                Add a table
              </Button>
              <form onSubmit={submitBatch} className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, roomLeft)}
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  placeholder="5"
                  aria-label="How many tables to add"
                  className="input max-w-[4.5rem] text-center"
                />
                <button
                  type="submit"
                  disabled={busy || roomLeft < 1}
                  className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink disabled:opacity-40"
                >
                  Add several
                </button>
              </form>
            </div>
          </div>

          <p className="border-b border-ink/5 bg-ink/[0.02] px-5 py-2 text-xs text-ink/45 sm:px-6">
            New tables continue from {highest + 1}. Numbers are never reused or
            renumbered, so a code already stuck on a table keeps working.
          </p>

          <div className="divide-y divide-ink/5">
            {tables.map((table) => (
              <div
                key={table.id}
                className="flex items-center gap-3 px-5 py-3 sm:px-6"
              >
                <span
                  className={cn(
                    "font-display text-base font-semibold",
                    table.isActive ? "text-ink" : "text-ink/35 line-through"
                  )}
                >
                  Table {table.number}
                </span>
                {!table.isActive && (
                  <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[0.7rem] uppercase tracking-wider text-ink/45">
                    Not taking orders
                  </span>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <button
                    disabled={busy}
                    onClick={() =>
                      send(
                        `/api/tables/${table.id}`,
                        {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isActive: !table.isActive }),
                        },
                        table.isActive
                          ? `Table ${table.number} stopped taking orders`
                          : `Table ${table.number} is taking orders`
                      )
                    }
                    title={
                      table.isActive
                        ? "Stop this table taking orders (keeps its number and its code)"
                        : "Let this table take orders again"
                    }
                    className={cn(
                      "rounded-full p-2.5 transition-colors disabled:opacity-40",
                      table.isActive
                        ? "text-green-700 hover:bg-green-900/10"
                        : "text-ink/30 hover:bg-ink/5"
                    )}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (
                        !confirm(
                          `Delete table ${table.number}?\n\n` +
                            "Past orders keep showing it. Any code already printed for it will stop working.\n\n" +
                            `Number ${table.number} will never be reused, whichever tables are deleted after it.\n\n` +
                            "To pause it instead and keep its code valid, use the power button."
                        )
                      ) {
                        return;
                      }
                      send(
                        `/api/tables/${table.id}`,
                        { method: "DELETE" },
                        `Table ${table.number} deleted`
                      );
                    }}
                    title="Delete this table"
                    className="rounded-full p-2.5 text-ink/40 transition-colors hover:bg-burgundy-800/10 hover:text-burgundy-700 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
