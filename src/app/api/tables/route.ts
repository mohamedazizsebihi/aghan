import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { getAdminSession } from "@/lib/auth";
import { addTablesSchema } from "@/lib/validators";
import { MAX_TABLE_COUNT } from "@/lib/table-qr";

// No GET handler on purpose: the admin page is a Server Component that reads
// the tables straight from the database, so an HTTP read endpoint would be
// surface nothing calls.

const MAX_ATTEMPTS = 5;

function isNumberCollision(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    (error.meta?.target as string[] | undefined)?.includes("number")
  );
}

/**
 * Adds `count` tables, numbered from the highest existing number upward.
 *
 * Creation *appends* — it never fills a gap left by a deletion. That is the rule
 * that keeps printed QR codes honest: a code says "Table 3", so number 3 must
 * mean the same physical table for as long as that card exists. Re-issuing 3 to
 * a new table would silently repoint a card already stuck to a table.
 *
 * A number, once assigned, is never changed either — PATCH only accepts
 * `isActive` (see [id]/route.ts), so there is no renumbering path at all.
 */
async function addTables(count: number) {
  // Deliberately NOT filtered on deletedAt. A retired table keeps its row
  // precisely so its number stays claimed here — filtering it out would hand
  // that number to a new table while the old printed card is still in use.
  const highest = await prisma.table.findFirst({
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const start = (highest?.number ?? 0) + 1;
  const last = start + count - 1;

  if (last > MAX_TABLE_COUNT) {
    return {
      error:
        `Table numbers stop at ${MAX_TABLE_COUNT}. ` +
        `This restaurant is already up to number ${highest?.number ?? 0}, ` +
        `so at most ${Math.max(0, MAX_TABLE_COUNT - (highest?.number ?? 0))} more can be added.`,
    };
  }

  const numbers = Array.from({ length: count }, (_, i) => start + i);
  await prisma.table.createMany({ data: numbers.map((number) => ({ number })) });
  return { created: numbers };
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = addTablesSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid table count" },
      { status: 400 }
    );
  }

  /**
   * Reading the highest number and inserting are two steps, so two admins
   * adding a table at the same moment both compute the same next number and one
   * hits the unique constraint. Retrying re-reads the maximum, which is now the
   * other's row — the same approach as order numbers in lib/orders.ts.
   */
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await addTables(parsed.data.count);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      // Only the created numbers: the caller re-renders the page from the
      // server afterwards, so shipping the whole table list here was a second
      // query nothing read.
      return NextResponse.json({ created: result.created });
    } catch (error) {
      if (!isNumberCollision(error) || attempt === MAX_ATTEMPTS) throw error;
    }
  }

  return NextResponse.json(
    { error: "Could not add tables just now — please try again." },
    { status: 409 }
  );
}
