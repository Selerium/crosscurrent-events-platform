import express from "express";
import ExcelJS from "exceljs";
import { prisma } from "../../lib/prismaClient.ts";
import { logAdminAction } from "../../lib/adminLog.ts";

const adminExportsHandler = express.Router();

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*\[\]:]/g, "_").slice(0, 31);
}

adminExportsHandler.get("/all-data", async (req, res) => {
  const workbook = new ExcelJS.Workbook();

  const [profiles, churches, events] = await Promise.all([
    prisma.profile.findMany({
      include: {
        user: { select: { email: true } },
        church: { select: { name: true } },
        _count: { select: { registrations: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.church.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.event.findMany({
      include: {
        _count: { select: { registrations: true } },
        registrations: { select: { paid: true, createdAt: true } },
      },
      orderBy: { startDate: "asc" },
    }),
  ]);

  const profileSheet = workbook.addWorksheet("Profiles");
  profileSheet.columns = [
    { header: "ID", key: "id", width: 36 },
    { header: "Name", key: "name", width: 25 },
    { header: "Email", key: "email", width: 30 },
    { header: "Phone", key: "phone", width: 18 },
    { header: "Role", key: "role", width: 12 },
    { header: "Gender", key: "gender", width: 10 },
    { header: "DOB", key: "dob", width: 14 },
    { header: "Age Category", key: "ageCategory", width: 14 },
    { header: "Nationality", key: "nationality", width: 18 },
    { header: "Approved", key: "approved", width: 10 },
    { header: "Church", key: "church", width: 25 },
    { header: "Primary Contact", key: "primaryForChurch", width: 16 },
    { header: "Parent Name", key: "parentOneName", width: 25 },
    { header: "Parent Email", key: "parentOneEmail", width: 30 },
    { header: "Parent Phone", key: "parentOnePhone", width: 18 },
    { header: "Registrations", key: "registrations", width: 14 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];
  for (const p of profiles) {
    profileSheet.addRow({
      id: p.id,
      name: p.name,
      email: p.user.email,
      phone: p.phone || "",
      role: p.role || "STUDENT",
      gender: p.gender || "",
      dob: p.dob ? p.dob.toISOString().split("T")[0] : "",
      ageCategory: p.ageCategory || "",
      nationality: p.nationality || "",
      approved: p.approved ? "Yes" : "No",
      church: p.church?.name || "",
      primaryForChurch: p.primaryForChurch ? "Yes" : "No",
      parentOneName: p.parentOneName || "",
      parentOneEmail: p.parentOneEmail || "",
      parentOnePhone: p.parentOnePhone || "",
      registrations: p._count.registrations,
      createdAt: p.createdAt.toISOString(),
    });
  }

  const churchSheet = workbook.addWorksheet("Churches");
  churchSheet.columns = [
    { header: "ID", key: "id", width: 36 },
    { header: "Name", key: "name", width: 25 },
    { header: "Country", key: "country", width: 18 },
    { header: "State", key: "state", width: 18 },
    { header: "Members", key: "members", width: 10 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];
  for (const c of churches) {
    churchSheet.addRow({
      id: c.id,
      name: c.name,
      country: c.country,
      state: c.state,
      members: c._count.members,
      createdAt: c.createdAt.toISOString(),
    });
  }

  const eventSheet = workbook.addWorksheet("Events");
  eventSheet.columns = [
    { header: "ID", key: "id", width: 36 },
    { header: "Name", key: "name", width: 25 },
    { header: "Brief", key: "brief", width: 40 },
    { header: "Location", key: "location", width: 20 },
    { header: "Status", key: "status", width: 12 },
    { header: "Start Date", key: "startDate", width: 14 },
    { header: "End Date", key: "endDate", width: 14 },
    { header: "Price", key: "price", width: 10 },
    { header: "Early Bird Price", key: "earlyBirdPrice", width: 16 },
    { header: "Early Bird Date", key: "earlyBirdDate", width: 14 },
    { header: "Max Sign-ups", key: "maxSignUps", width: 12 },
    { header: "Registrations", key: "registrations", width: 14 },
    { header: "Paid Registrations", key: "paidRegistrations", width: 18 },
    { header: "Revenue", key: "revenue", width: 12 },
    { header: "Created At", key: "createdAt", width: 20 },
  ];
  const statusMap: Record<string, string> = { OPEN: "Open", CLOSED: "Closed", COMPLETED: "Completed" };
  for (const e of events) {
    const paid = e.registrations.filter((r) => r.paid);
    const revenue = paid.reduce((sum, r) => {
      if (e.earlyBirdDate && e.earlyBirdPrice && r.createdAt <= e.earlyBirdDate) {
        return sum + e.earlyBirdPrice;
      }
      return sum + e.price;
    }, 0);
    eventSheet.addRow({
      id: e.id,
      name: e.name,
      brief: e.brief,
      location: e.location,
      status: statusMap[e.eventStatus] || e.eventStatus,
      startDate: e.startDate.toISOString().split("T")[0],
      endDate: e.endDate.toISOString().split("T")[0],
      price: e.price,
      earlyBirdPrice: e.earlyBirdPrice ?? "",
      earlyBirdDate: e.earlyBirdDate ? e.earlyBirdDate.toISOString().split("T")[0] : "",
      maxSignUps: e.maxSignUps,
      registrations: e._count.registrations,
      paidRegistrations: paid.length,
      revenue,
      createdAt: e.createdAt.toISOString(),
    });
  }

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "exports.all_data",
    targetType: "export",
    details: { profiles: profiles.length, churches: churches.length, events: events.length },
    success: true,
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=all-data.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

adminExportsHandler.get("/churches", async (req, res) => {
  const workbook = new ExcelJS.Workbook();

  const churches = await prisma.church.findMany({
    include: {
      members: {
        include: { user: { select: { email: true } } },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  for (const church of churches) {
    const sheet = workbook.addWorksheet(sanitizeSheetName(church.name));
    sheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Role", key: "role", width: 12 },
      { header: "Gender", key: "gender", width: 10 },
      { header: "DOB", key: "dob", width: 14 },
      { header: "Age Category", key: "ageCategory", width: 14 },
      { header: "Phone", key: "phone", width: 18 },
      { header: "Nationality", key: "nationality", width: 18 },
      { header: "Approved", key: "approved", width: 10 },
      { header: "Primary Contact", key: "primaryForChurch", width: 16 },
      { header: "Parent Name", key: "parentOneName", width: 25 },
      { header: "Parent Email", key: "parentOneEmail", width: 30 },
      { header: "Parent Phone", key: "parentOnePhone", width: 18 },
      { header: "Joined", key: "createdAt", width: 20 },
    ];
    for (const m of church.members) {
      sheet.addRow({
        name: m.name,
        email: m.user.email,
        role: m.role || "STUDENT",
        gender: m.gender || "",
        dob: m.dob ? m.dob.toISOString().split("T")[0] : "",
        ageCategory: m.ageCategory || "",
        phone: m.phone || "",
        nationality: m.nationality || "",
        approved: m.approved ? "Yes" : "No",
        primaryForChurch: m.primaryForChurch ? "Yes" : "No",
        parentOneName: m.parentOneName || "",
        parentOneEmail: m.parentOneEmail || "",
        parentOnePhone: m.parentOnePhone || "",
        createdAt: m.createdAt.toISOString(),
      });
    }
  }

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "exports.churches",
    targetType: "export",
    details: { churches: churches.length },
    success: true,
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=churches.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

adminExportsHandler.get("/events", async (req, res) => {
  const workbook = new ExcelJS.Workbook();

  const events = await prisma.event.findMany({
    include: {
      registrations: {
        include: {
          profile: {
            include: { user: { select: { email: true } } },
          },
          spouse: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { startDate: "asc" },
  });

  for (const event of events) {
    const sheet = workbook.addWorksheet(sanitizeSheetName(event.name));
    sheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Role", key: "role", width: 12 },
      { header: "Age Category", key: "ageCategory", width: 14 },
      { header: "Paid", key: "paid", width: 8 },
      { header: "Shirt Size", key: "shirtSize", width: 12 },
      { header: "Swimming", key: "swimming", width: 10 },
      { header: "Self Pay", key: "selfPay", width: 10 },
      { header: "Medications", key: "medications", width: 30 },
      { header: "Allergies", key: "allergies", width: 30 },
      { header: "Emergency Name", key: "emergencyName", width: 25 },
      { header: "Emergency Phone", key: "emergencyPhone", width: 18 },
      { header: "Notes", key: "notes", width: 30 },
      { header: "Media Consent", key: "mediaConsent", width: 14 },
      { header: "Swimming Permission", key: "swimmingPermission", width: 18 },
      { header: "Parent Verified", key: "parentVerified", width: 16 },
      { header: "Group", key: "group", width: 15 },
      { header: "Room", key: "room", width: 15 },
      { header: "Leader Role", key: "primaryLeaderRole", width: 20 },
      { header: "Secondary Roles", key: "secondaryLeaderRoles", width: 35 },
      { header: "Spouse", key: "spouse", width: 25 },
      { header: "Registered At", key: "createdAt", width: 20 },
    ];
    for (const r of event.registrations) {
      sheet.addRow({
        name: r.profile.name,
        email: r.profile.user.email,
        role: r.profile.role || "STUDENT",
        ageCategory: r.profile.ageCategory || "",
        paid: r.paid ? "Yes" : "No",
        shirtSize: r.shirtSize,
        swimming: r.swimming ? "Yes" : "No",
        selfPay: r.selfPay ? "Yes" : "No",
        medications: r.medications.join(", "),
        allergies: r.allergies.join(", "),
        emergencyName: r.emergencyName,
        emergencyPhone: r.emergencyPhone,
        notes: r.notes || "",
        mediaConsent: r.mediaConsent ? "Yes" : "No",
        swimmingPermission: r.swimmingPermission ? "Yes" : "No",
        parentVerified: r.parentVerified ? "Yes" : "No",
        group: r.group || "",
        room: r.room || "",
        primaryLeaderRole: r.primaryLeaderRole
          ? r.primaryLeaderRole.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
          : "",
        secondaryLeaderRoles: r.secondaryLeaderRoles
          .map((s) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()))
          .join(", "),
        spouse: r.spouse?.name || "",
        createdAt: r.createdAt.toISOString(),
      });
    }
  }

  logAdminAction({
    adminId: req.user.id,
    adminName: req.user.name,
    action: "exports.events",
    targetType: "export",
    details: { events: events.length },
    success: true,
  });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=events.xlsx");
  await workbook.xlsx.write(res);
  res.end();
});

export default adminExportsHandler;
