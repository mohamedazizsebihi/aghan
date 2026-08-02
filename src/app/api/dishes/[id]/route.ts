import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { dishInputSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const dish = await prisma.dish.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!dish) {
    return NextResponse.json({ error: "Dish not found" }, { status: 404 });
  }
  return NextResponse.json({ dish });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const json = await request.json().catch(() => null);
  const parsed = dishInputSchema.partial().safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid dish data" },
      { status: 400 }
    );
  }

  const data = { ...parsed.data };
  if (data.slug) data.slug = slugify(data.slug);

  const dish = await prisma.dish.update({ where: { id }, data });
  return NextResponse.json({ dish });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.dish.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
