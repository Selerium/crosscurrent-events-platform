import { prisma } from "./prismaClient.ts";

type NotificationInput = {
  type: string;
  title: string;
  message: string;
  link: string;
};

export async function createNotifications(
  profileIds: string[],
  data: NotificationInput
) {
  const ids = [...new Set(profileIds)].filter(
    (id): id is string => Boolean(id)
  );
  if (ids.length === 0) return;

  await prisma.notification.createMany({
    data: ids.map((profileId) => ({ profileId, ...data })),
  });
}
