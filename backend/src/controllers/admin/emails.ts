import express from "express";
import AppError from "../../lib/appError.ts";
import { prisma } from "../../lib/prismaClient.ts";
import { logAdminAction } from "../../lib/adminLog.ts";
import { buildBulkEmailHtml, sendBulkEmails } from "../../lib/email.ts";

const adminEmailsHandler = express.Router();

type Audience = "all" | "leaders" | "students" | "event" | "church";

const AUDIENCES: Audience[] = ["all", "leaders", "students", "event", "church"];

const PREVIEW_LIMIT = 20;

type Recipient = {
  profileId: string;
  name: string;
  email: string;
  age: number | null;
};

function parseAgeBound(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 120) {
    throw new AppError("Age bounds must be whole numbers between 0 and 120", 400);
  }
  return parsed;
}

function calculateAge(dob: Date, now: Date): number {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

async function resolveRecipients(input: {
  audience: Audience;
  eventId?: string;
  churchId?: string;
  minAge?: number;
  maxAge?: number;
}): Promise<{ recipients: Recipient[]; summary: string }> {
  const { audience, eventId, churchId, minAge, maxAge } = input;

  if (!AUDIENCES.includes(audience)) {
    throw new AppError("Invalid audience", 400);
  }
  if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
    throw new AppError("Minimum age cannot be greater than maximum age", 400);
  }

  // Admins are never targeted by bulk emails.
  const roleFilter =
    audience === "leaders"
      ? "LEADER"
      : audience === "students"
        ? "STUDENT"
        : { in: ["STUDENT", "LEADER"] };

  let eventName: string | null = null;
  let profileIds: string[] | null = null;

  if (audience === "event") {
    if (!eventId) {
      throw new AppError("An event must be selected for this audience", 400);
    }
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true },
    });
    if (!event) {
      throw new AppError("Event not found", 404);
    }
    eventName = event.name;
    const registrations = await prisma.registration.findMany({
      where: { eventId },
      select: { profileId: true },
    });
    profileIds = [...new Set(registrations.map((r) => r.profileId))];
    if (profileIds.length === 0) {
      return { recipients: [], summary: `Nobody registered for ${eventName}` };
    }
  }

  let churchName: string | null = null;
  if (audience === "church") {
    if (!churchId) {
      throw new AppError("A church must be selected for this audience", 400);
    }
    const church = await prisma.church.findUnique({
      where: { id: churchId },
      select: { id: true, name: true },
    });
    if (!church) {
      throw new AppError("Church not found", 404);
    }
    churchName = church.name;
  }

  const where: Record<string, unknown> = {
    role: roleFilter,
    user: { emailVerified: true },
  };
  if (profileIds) {
    where.id = { in: profileIds };
  }
  if (churchId && audience === "church") {
    where.churchId = churchId;
  }

  const profiles = await prisma.profile.findMany({
    where,
    include: { user: { select: { email: true } } },
    orderBy: { name: "asc" },
  });

  const now = new Date();
  const seen = new Set<string>();
  const recipients: Recipient[] = [];

  for (const p of profiles) {
    const email = p.user.email.toLowerCase();
    if (seen.has(email)) continue;

    let age: number | null = null;
    if (p.dob) {
      age = calculateAge(new Date(p.dob), now);
    }

    if ((minAge !== undefined || maxAge !== undefined) && age === null) {
      continue;
    }
    if (minAge !== undefined && (age === null || age < minAge)) continue;
    if (maxAge !== undefined && (age === null || age > maxAge)) continue;

    seen.add(email);
    recipients.push({ profileId: p.id, name: p.name, email: p.user.email, age });
  }

  const base =
    audience === "leaders"
      ? "leaders"
      : audience === "students"
        ? "students"
        : audience === "event"
          ? `users registered for ${eventName}`
          : audience === "church"
            ? `members of ${churchName}`
            : "students and leaders";

  const agePart =
    minAge !== undefined && maxAge !== undefined
      ? ` aged ${minAge}\u2013${maxAge}`
      : minAge !== undefined
        ? ` aged ${minAge}+`
        : maxAge !== undefined
          ? ` aged up to ${maxAge}`
          : "";

  return { recipients, summary: `${recipients.length} ${base}${agePart}` };
}

function readFilters(body: Record<string, unknown>) {
  const audience = body.audience as Audience;
  const eventId = body.eventId ? String(body.eventId) : undefined;
  const churchId = body.churchId ? String(body.churchId) : undefined;
  const minAge = parseAgeBound(body.minAge);
  const maxAge = parseAgeBound(body.maxAge);
  return { audience, eventId, churchId, minAge, maxAge };
}

adminEmailsHandler.post("/recipients", async (req, res) => {
  const filters = readFilters(req.body ?? {});
  const { recipients, summary } = await resolveRecipients(filters);

  res.status(200).json({
    data: {
      total: recipients.length,
      summary,
      preview: recipients.slice(0, PREVIEW_LIMIT).map((r) => ({
        name: r.name,
        email: r.email,
        age: r.age,
      })),
    },
    error: false,
    message: "",
  });
});

adminEmailsHandler.post("", async (req, res) => {
  const { audience, eventId, churchId, minAge, maxAge } = readFilters(req.body ?? {});
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description =
    typeof req.body?.description === "string" ? req.body.description.trim() : "";

  if (!title) {
    throw new AppError("Title is required", 400);
  }
  if (title.length > 200) {
    throw new AppError("Title must be 200 characters or fewer", 400);
  }
  if (!description) {
    throw new AppError("Description is required", 400);
  }
  if (description.length > 10000) {
    throw new AppError("Description must be 10000 characters or fewer", 400);
  }

  const { recipients } = await resolveRecipients({
    audience,
    eventId,
    churchId,
    minAge,
    maxAge,
  });

  if (recipients.length === 0) {
    throw new AppError("No recipients match the selected filters", 400);
  }

  const subject = `${title} | CrossCurrent`;
  const html = buildBulkEmailHtml(title, description);
  const text = `${title}\n\n${description}`;

  const { sent, failed } = await sendBulkEmails(
    recipients.map((r) => r.email),
    subject,
    html,
    text
  );

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "email.bulk_send",
    targetType: "email",
    details: {
      audience,
      eventId: eventId ?? undefined,
      churchId: churchId ?? undefined,
      minAge: minAge ?? undefined,
      maxAge: maxAge ?? undefined,
      subject,
      total: recipients.length,
      sent,
      failed,
    },
    success: failed < recipients.length,
  });

  res.status(200).json({
    data: { total: recipients.length, sent, failed },
    error: false,
    message: `Email sent to ${sent} of ${recipients.length} recipient(s)`,
  });
});

export default adminEmailsHandler;
