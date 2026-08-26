import { Role, Gender, ShirtSize } from "../generated/prisma/client.ts";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prismaClient.ts"

const adminPass = process.env.ADMIN_PASS || "adminpass"

const churches = {
  "Abu Dhabi": ["St. Andrew's Church", "Cornerstone", "Grace Church", "Igreja Brasileira de Abu Dhabi", "Saving Grace Global Ministries", "Evangelical Community Church", ],
  "Al Ain": ["United TECAA", ],
  "Dubai": ["Redeemer Church", "Fellowship Dubai", "Kingdomcity Church", "Edify Church", "Holy Trinity", ],
  "Fujairah": ["Assemblies of God Church", "Immanuel Church of Fujairah" ],
  "Sharjah": ["Servants of God Church", "St. Martin's Church"],
  "Ras Al Khaimah": ["New Life Church", ],
}

async function main() {
  console.log("Seeding database...");

  let created = 0;
  let skipped = 0;

  const createChurchIfMissing = async (
    name: string,
    country: string,
    state: string
  ) => {
    const existing = await prisma.church.findFirst({
      where: { name, country, state },
    });
    if (existing) {
      skipped++;
      return;
    }
    await prisma.church.create({ data: { name, country, state } });
    created++;
  };

  for (const [state, names] of Object.entries(churches)) {
    for (const name of names) {
      await createChurchIfMissing(name, "UAE", state);
    }
  }
  await createChurchIfMissing("Other", "Other", "Other");

  console.log(`Churches created: ${created}, skipped: ${skipped}`);

  const passwordHash = await bcrypt.hash(adminPass, 10);
  const user1 = await prisma.user.create({
    data: {
      email: "adi@eyu.ae",
      password: passwordHash,
      emailVerified: true,
      profile: {
        create: {
          name: "John Adithya",
          role: Role.ADMIN,
          firstTime: false,
          phone: "+971555532396",
          approved: true,
        },
      },
    },
    include: { profile: true },
  });
  const user2 = await prisma.user.create({
    data: {
      email: "surya@eyu.ae",
      password: passwordHash,
      emailVerified: true,
      profile: {
        create: {
          name: "John Surya",
          role: Role.ADMIN,
          firstTime: false,
          phone: "+971555911969",
          approved: true,
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
