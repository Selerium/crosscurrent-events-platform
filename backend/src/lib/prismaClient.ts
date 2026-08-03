import { PrismaClient, Role, EventStatus, PrimaryLeaderRoles, SecondaryLeaderRoles } from "../../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma, Role, EventStatus, PrimaryLeaderRoles, SecondaryLeaderRoles };