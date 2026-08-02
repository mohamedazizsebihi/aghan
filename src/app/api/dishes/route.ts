import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/auth";
import { dishInputSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const admin = await getAdminSession();
  const categorySlug = request.nextUrl.searchParams.get("category");
  const includeUnavailable = Boolean(admin);

  const dishes = await prisma.dish.findMany({
    where: {
      isAvailable: includeUnavailable ? undefined : true,
      category: categorySlug ? { slug: categorySlug } : undefined,
    },
    include: { category: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });

  return NextResponse.json({ dishes });
}

export async function POST(request: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = dishInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid dish data" },
      { status: 400 }
    );
  }

  const slug = slugify(parsed.data.slug || parsed.data.name);
  const dish = await prisma.dish.create({
    data: { ...parsed.data, slug },
  });

  return NextResponse.json({ dish }, { status: 201 });
}
