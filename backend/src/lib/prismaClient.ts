import { PrismaClient, Role, EventStatus, PaymentMethod, RequiredActionType, RequiredActionAudience, RequiredActionStatus, CheckInStatus } from "../../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

export { prisma, Role, EventStatus, PaymentMethod, RequiredActionType, RequiredActionAudience, RequiredActionStatus, CheckInStatus };