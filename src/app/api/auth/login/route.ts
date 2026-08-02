import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createAdminSession } from "@/lib/auth";
import { adminLoginSchema } from "@/lib/validators";
import { guardPublicRequest, PUBLIC_LIMITS } from "@/lib/api-limits";

export async function POST(request: NextRequest) {
  const guard = await guardPublicRequest(request, "login", PUBLIC_LIMITS.login);
  if (!guard.ok) return guard.response;

  const parsed = adminLoginSchema.safeParse(guard.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const admin = await prisma.admin.findUnique({
    where: { email: parsed.data.email },
  });

  const valid =
    admin && (await bcrypt.compare(parsed.data.password, admin.passwordHash));

  if (!admin || !valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await createAdminSession(admin.id);

  return NextResponse.json({ success: true });
}
