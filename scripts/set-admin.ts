import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

/**
 * Creates or updates the admin account, and touches nothing else.
 *
 * This lives apart from `prisma/seed.ts` on purpose. The seed rebuilds the demo
 * menu — it deletes dishes and categories added from the admin and resets every
 * price and photo to its seeded value — yet it was the only documented way to
 * change the admin password. An owner following the docs three months after
 * opening would have lost every price they had adjusted and every photo they
 * had uploaded, to change one password.
 *
 * Usage:
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… npx tsx scripts/set-admin.ts
 *   docker compose exec app npx tsx scripts/set-admin.ts   (reads .env.production)
 */
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD before running this.\n" +
        "In production they come from .env.production.",
    );
    process.exit(1);
  }

  // Not a policy, just a floor: this account is the whole back office, and the
  // example file ships a placeholder that is easy to leave in place.
  if (password.length < 12) {
    console.error("ADMIN_PASSWORD must be at least 12 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.admin.findUnique({ where: { email } });

  await prisma.admin.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(
    existing ? `Password updated for ${email}.` : `Admin account created for ${email}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
