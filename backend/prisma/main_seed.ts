import { Role, Gender, ShirtSize } from "../generated/prisma/client.ts";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prismaClient.ts"

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("adminpass", 10);
  const user = await prisma.user.create({
    data: {
      email: "admin@crosscurrent.ae",
      password: passwordHash,
      profile: {
        create: {
          name: "Admin",
          role: Role.ADMIN,
          firstTime: false,
          phone: "+971555532396",
        },
      },
    },
    include: { profile: true },
  });

  console.log("Admin profile created");
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
