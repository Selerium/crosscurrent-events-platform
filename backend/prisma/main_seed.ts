import { Role, Gender, ShirtSize } from "../generated/prisma/client.ts";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prismaClient.ts"

const churches = {
  "Abu Dhabi": ["St. Andrew's Church", "Cornerstone", "Grace Church", "Igreja Brasileira de Abu Dhabi", "Saving Grace Global Ministries", ],
  "Al Ain": ["Al Ain Evangelical Church", "Redeemer Church", "Nepali Bible Sangati", ],
  "Dubai": ["Redeemer Church", "Fellowship Dubai", "Kingdomcity Church", "Edify Church", ],
  "Fujairah": ["Assemblies of God Church", "Immanuel Church of Fujairah" ],
  "Sharjah": ["Servants of God Church", ],
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

  const passwordHash = await bcrypt.hash("adminpass", 10);
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
        },
      },
    },
    include: { profile: true },
  });
  // const user2 = await prisma.user.create({
  //   data: {
  //     email: "surya@eyu.ae",
  //     password: passwordHash,
  //     emailVerified: true,
  //     profile: {
  //       create: {
  //         name: "John Surya",
  //         role: Role.ADMIN,
  //         firstTime: false,
  //         phone: "+971555911969",
  //       },
  //     },
  //   },
  //   include: { profile: true },
  // });

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
