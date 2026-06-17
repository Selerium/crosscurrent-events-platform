import { prisma, Role } from "../src/lib/prismaClient.ts";

import bcrypt from "bcryptjs";

async function main() {
  await prisma.refreshTokens.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.user.deleteMany();

  const hashedPassword = await bcrypt.hash("password123", 10);

  const adminUser = await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: hashedPassword,
      profile: {
        create: {
          name: "Admin User",
          role: Role.ADMIN,
        },
      },
    },
    include: {
      profile: true,
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      email: "customer@example.com",
      password: hashedPassword,
      profile: {
        create: {
          name: "John Customer",
          role: Role.CUSTOMER,
        },
      },
    },
    include: {
      profile: true,
    },
  });

  console.log("Database seeded successfully");
  console.log({ adminUser, customerUser });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
