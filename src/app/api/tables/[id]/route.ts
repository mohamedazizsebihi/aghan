import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { tableUpdateSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

/** Also the answer for an already-retired table: it is gone as far as the admin is concerned. */
function notFound() {
  return NextResponse.json({ error: "Table not found" }, { status: 404 });
}

/** Activate or deactivate a table. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = tableUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid table update" }, { status: 400 });
  }

  // updateMany rather than update so a deleted table cannot be revived by
  // PATCHing isActive back to true — `where` on update only takes unique fields.
  const { count } = await prisma.table.updateMany({
    where: { id, deletedAt: null },
    data: parsed.data,
  });
  if (count === 0) return notFound();

  const table = await prisma.table.findUnique({ where: { id } });
  return NextResponse.json({ table });
}

/**
 * Retires a table. This is a soft delete, and it must stay one.
 *
 * A hard delete freed the number for reuse: deleting the highest table meant the
 * next "add" handed its number to a different physical table, while the printed
 * card still sat on the old one and sent customers' orders to the wrong place.
 * Keeping the row keeps `number @unique` holding that value forever, so the next
 * number is still max(number) + 1 with no separate high-water mark to maintain.
 *
 * Also clears isActive, which is what makes buildOrderFromCart refuse orders for
 * a retired table without needing to know about deletion at all.
 *
 * Safe for history either way: an Order stores the table *number* it was placed
 * for rather than a reference to this row (see prisma/schema.prisma), so past
 * orders keep reading "Table 7".
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { count } = await prisma.table.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
  if (count === 0) return notFound();

  return NextResponse.json({ success: true });
}
