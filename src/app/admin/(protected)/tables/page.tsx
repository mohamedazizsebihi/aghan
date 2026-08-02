import { prisma } from "@/lib/prisma";
import { TableManager } from "@/components/admin/TableManager";
import { TableQrCodes } from "@/components/admin/TableQrCodes";
import { resolveBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

export default async function AdminTablesPage() {
  // Retired tables keep their row so their number stays claimed, but they are
  // gone as far as the admin is concerned.
  const tables = await prisma.table.findMany({
    where: { deletedAt: null },
    orderBy: { number: "asc" },
  });

  // Across every row, retired ones included — that is what the API counts from,
  // and the admin is told the next number before they commit to adding one.
  const highestEverIssued = await prisma.table.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  // Only active tables get a code: an inactive table's order would be refused
  // at checkout, so printing one would just be a code that quietly does nothing.
  const activeNumbers = tables.filter((t) => t.isActive).map((t) => t.number);

  return (
    <div>
      <div className="no-print">
        <h1 className="font-display text-3xl font-bold text-ink">Tables</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink/50">
          The tables listed here are the ones customers can order from. Each
          active table gets a QR code below — print it, cut it out, and put it on
          the table. Customers scan it with their phone camera and the menu opens
          on their dine-in order.
        </p>
        <div className="mt-6">
          <TableManager
            tables={tables}
            highest={highestEverIssued?.number ?? 0}
          />
        </div>
      </div>

      {tables.length > 0 && (
        <div className="mt-10">
          <h2 className="no-print font-display text-2xl font-bold text-ink">
            QR Codes
          </h2>

          {activeNumbers.length === 0 ? (
            // Without this, pausing every table left the page ending abruptly
            // after the list, with no hint as to why the codes had vanished.
            <p className="no-print mt-4 rounded-2xl bg-white px-6 py-8 text-center text-sm text-ink/50 shadow-sm ring-1 ring-ink/5">
              Every table is paused, so there are no codes to print. Switch a
              table back on with its power button and its code reappears here —
              unchanged, so anything already printed still works.
            </p>
          ) : (
            <TableQrCodes
              tableNumbers={activeNumbers}
              envBaseUrl={(await resolveBaseUrl()) ?? undefined}
            />
          )}
        </div>
      )}
    </div>
  );
}
