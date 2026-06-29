import { Role, Gender, ShirtSize } from "../generated/prisma/client.ts";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prismaClient.ts"

async function main() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("password123", 10);

  // --- Churches ---
  const citylight = await prisma.church.create({
    data: {
      name: "CityLight Church",
      country: "USA",
      state: "California",
    },
  });

  const harbour = await prisma.church.create({
    data: {
      name: "Harbour Community Church",
      country: "Australia",
      state: "New South Wales",
    },
  });

  const livingWaters = await prisma.church.create({
    data: {
      name: "Living Waters Chapel",
      country: "UK",
      state: "London",
    },
  });

  console.log("Churches created");

  // --- Users + Profiles ---
  const usersData = [
    {
      email: "admin@crosscurrent.com",
      name: "John Smith",
      role: Role.ADMIN,
      gender: Gender.MALE,
      churchId: citylight.id,
    },
    {
      email: "sarah@crosscurrent.com",
      name: "Sarah Johnson",
      role: Role.LEADER,
      gender: Gender.FEMALE,
      churchId: citylight.id,
    },
    {
      email: "mike@crosscurrent.com",
      name: "Mike Davis",
      role: Role.LEADER,
      gender: Gender.MALE,
      churchId: harbour.id,
    },
    {
      email: "emma@crosscurrent.com",
      name: "Emma Wilson",
      role: Role.STUDENT,
      gender: Gender.FEMALE,
      churchId: citylight.id,
    },
    {
      email: "jake@crosscurrent.com",
      name: "Jake Thompson",
      role: Role.STUDENT,
      gender: Gender.MALE,
      churchId: citylight.id,
    },
    {
      email: "olivia@crosscurrent.com",
      name: "Olivia Brown",
      role: Role.STUDENT,
      gender: Gender.FEMALE,
      churchId: harbour.id,
    },
    {
      email: "liam@crosscurrent.com",
      name: "Liam Patel",
      role: Role.STUDENT,
      gender: Gender.MALE,
      churchId: livingWaters.id,
    },
  ];

  const createdProfiles = [];
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        password: passwordHash,
        profile: {
          create: {
            name: u.name,
            role: u.role,
            gender: u.gender,
            churchId: u.churchId,
            primaryForChurch: u.role === Role.ADMIN || u.role === Role.LEADER,
            firstTime: false,
            nationality: u.churchId === citylight.id ? "American" : u.churchId === harbour.id ? "Australian" : "British",
            phone: "+1-555-0100",
            dob: new Date("2005-06-15"),
            parentOneName: "Parent Name",
            parentOneEmail: "parent@example.com",
            parentOnePhone: "+1-555-0199",
          },
        },
      },
      include: { profile: true },
    });
    createdProfiles.push(user.profile!);
  }

  console.log("Users and profiles created");

  // --- Events ---
  const summerCamp = await prisma.event.create({
    data: {
      name: "Summer Youth Camp 2026",
      brief: "A week-long summer camp filled with worship, workshops, and outdoor activities for youth.",
      startDate: new Date("2026-07-13T09:00:00Z"),
      endDate: new Date("2026-07-20T17:00:00Z"),
      maxSignUps: 200,
      location: "Pine Ridge Retreat Center, California",
      price: 35000,
      earlyBirdPrice: 29900,
      earlyBirdDate: new Date("2026-05-01T00:00:00Z"),
      schedule: [
        [
          { item: "Arrival & Icebreakers", description: "Check-in and welcome activities to help everyone get to know each other", startTime: "14:00", endTime: "17:00", location: "Main Hall" },
          { item: "Evening Worship", description: "Opening worship session with live band and message", startTime: "19:00", endTime: "21:00", location: "Chapel" },
        ],
        [
          { item: "Morning Workshop: Identity in Christ", description: "Teaching session on finding your identity in faith", startTime: "09:00", endTime: "12:00", location: "Seminar Room A" },
          { item: "Afternoon Sports", description: "Team sports and outdoor games", startTime: "14:00", endTime: "17:00", location: "Sports Field" },
          { item: "Evening Worship", description: "Evening session with worship and guest speaker", startTime: "19:00", endTime: "21:00", location: "Chapel" },
        ],
        [
          { item: "Morning Workshop: Prayer", description: "Practical workshop on different forms of prayer", startTime: "09:00", endTime: "12:00", location: "Seminar Room B" },
          { item: "Hiking Trip", description: "Guided hike through the surrounding trails", startTime: "13:00", endTime: "17:00", location: "Pine Ridge Trail" },
          { item: "Campfire & Testimonies", description: "Evening around the campfire sharing stories and testimonies", startTime: "20:00", endTime: "22:00", location: "Campfire Pit" },
        ],
        [
          { item: "Morning Workshop: Leadership", description: "Developing leadership skills through interactive exercises", startTime: "09:00", endTime: "12:00", location: "Seminar Room A" },
          { item: "Free Time / Workshops", description: "Free time to choose from various activity stations", startTime: "14:00", endTime: "17:00", location: "Various Locations" },
          { item: "Talent Show", description: "Showcase your talents — music, drama, comedy and more", startTime: "19:00", endTime: "21:30", location: "Main Hall" },
        ],
        [
          { item: "Morning Worship", description: "Closing worship and communion service", startTime: "10:00", endTime: "12:00", location: "Chapel" },
          { item: "Departure", description: "Check-out and farewells", startTime: "14:00", endTime: "15:00", location: "Main Hall" },
        ],
      ],
    },
  });

  const leadershipConf = await prisma.event.create({
    data: {
      name: "Leadership Conference 2026",
      brief: "Equipping the next generation of leaders with practical skills and spiritual foundations.",
      startDate: new Date("2026-03-20T09:00:00Z"),
      endDate: new Date("2026-03-22T17:00:00Z"),
      maxSignUps: 100,
      location: "CityLight Church Auditorium, California",
      price: 15000,
      earlyBirdPrice: 12000,
      earlyBirdDate: new Date("2026-02-01T00:00:00Z"),
      schedule: [
        [
          { item: "Registration & Welcome", description: "Check-in, welcome packets, and opening announcements", startTime: "08:30", endTime: "09:45", location: "Foyer" },
          { item: "Keynote: Visionary Leadership", description: "Main keynote address on leading with purpose and vision", startTime: "10:00", endTime: "12:00", location: "Auditorium" },
          { item: "Breakout Sessions", description: "Choose from various breakout topics led by experienced leaders", startTime: "14:00", endTime: "16:00", location: "Various Rooms" },
        ],
        [
          { item: "Workshop: Team Building", description: "Hands-on workshop on building and leading effective teams", startTime: "09:00", endTime: "12:00", location: "Auditorium" },
          { item: "Panel Discussion", description: "Q&A panel with church leaders on real-world leadership challenges", startTime: "14:00", endTime: "16:00", location: "Auditorium" },
          { item: "Evening Networking", description: "Informal dinner and networking with fellow leaders", startTime: "19:00", endTime: "21:00", location: "Dining Hall" },
        ],
        [
          { item: "Workshop: Conflict Resolution", description: "Practical strategies for resolving conflicts in ministry settings", startTime: "09:00", endTime: "12:00", location: "Auditorium" },
          { item: "Closing Session & Commissioning", description: "Final session with prayer and commissioning for attendees", startTime: "14:00", endTime: "16:00", location: "Auditorium" },
        ],
      ],
    },
  });

  const winterRetreat = await prisma.event.create({
    data: {
      name: "Winter Retreat 2026",
      brief: "A weekend away to disconnect, reflect, and encounter God in the beauty of winter.",
      startDate: new Date("2026-12-04T16:00:00Z"),
      endDate: new Date("2026-12-07T12:00:00Z"),
      maxSignUps: 80,
      location: "Snowy Mountains Lodge, New South Wales",
      price: 25000,
      schedule: [
        [
          { item: "Arrival & Cabin Allocations", description: "Check-in and settle into your cabins", startTime: "16:00", endTime: "18:00", location: "Lodge Reception" },
          { item: "Opening Session", description: "Welcome and opening message for the retreat", startTime: "19:00", endTime: "21:00", location: "Lodge Hall" },
        ],
        [
          { item: "Morning Devotions", description: "Quiet time and guided devotions to start the day", startTime: "08:00", endTime: "09:00", location: "Chapel" },
          { item: "Snow Activities", description: "Skiing, snowboarding, and snow play", startTime: "10:00", endTime: "16:00", location: "Snowy Mountains Slopes" },
          { item: "Evening Worship", description: "Worship session with speaker", startTime: "19:00", endTime: "21:00", location: "Lodge Hall" },
        ],
        [
          { item: "Morning Session", description: "Teaching session on spiritual disciplines", startTime: "09:00", endTime: "12:00", location: "Lodge Hall" },
          { item: "Free Time", description: "Afternoon at leisure — explore, rest, or connect with others", startTime: "13:00", endTime: "17:00", location: "Throughout Lodge" },
          { item: "Testimony Night", description: "Evening of shared testimonies and stories of faith", startTime: "19:00", endTime: "21:30", location: "Lodge Hall" },
        ],
        [
          { item: "Breakfast & Departure", description: "Final breakfast together and check-out", startTime: "08:00", endTime: "10:00", location: "Dining Room" },
        ],
      ],
    },
  });

  const worshipNight = await prisma.event.create({
    data: {
      name: "CrossCurrent Worship Night",
      brief: "An evening of united worship across all our churches. All are welcome.",
      startDate: new Date("2026-08-15T18:00:00Z"),
      endDate: new Date("2026-08-15T21:00:00Z"),
      maxSignUps: 500,
      location: "Harbour Community Church, Sydney",
      price: 0,
      schedule: [
        [
          { item: "Doors Open", description: "Venue opens and welcome team greets attendees", startTime: "18:00", endTime: "18:30", location: "Main Entrance" },
          { item: "Worship Set 1", description: "Opening worship session led by the worship team", startTime: "18:30", endTime: "19:15", location: "Auditorium" },
          { item: "Message", description: "Guest speaker shares a message on worship", startTime: "19:15", endTime: "20:00", location: "Auditorium" },
          { item: "Worship Set 2", description: "Continued worship ministry after the message", startTime: "20:00", endTime: "20:45", location: "Auditorium" },
          { item: "Prayer & Ministry Time", description: "Personal prayer and ministry for attendees", startTime: "20:45", endTime: "21:30", location: "Auditorium" },
        ],
      ],
    },
  });

  console.log("Events created");

  // --- Registrations ---
  const registrationsData = [
    {
      profileId: createdProfiles[0].id, // John (admin)
      eventId: leadershipConf.id,
      shirtSize: ShirtSize.L,
      swimming: true,
      selfPay: false,
      paid: false,
      medications: [],
      allergies: [],
      room: "A101",
      group: "Leaders",
    },
    {
      profileId: createdProfiles[1].id, // Sarah (leader)
      eventId: summerCamp.id,
      shirtSize: ShirtSize.M,
      swimming: true,
      selfPay: false,
      paid: true,
      medications: [],
      allergies: ["Peanuts"],
      room: "B204",
      group: "CityLight",
    },
    {
      profileId: createdProfiles[1].id, // Sarah (leader)
      eventId: leadershipConf.id,
      shirtSize: ShirtSize.M,
      swimming: false,
      selfPay: false,
      paid: false,
      medications: [],
      allergies: ["Peanuts"],
    },
    {
      profileId: createdProfiles[2].id, // Mike (leader)
      eventId: leadershipConf.id,
      shirtSize: ShirtSize.XL,
      swimming: false,
      selfPay: false,
      paid: true,
      medications: [],
      allergies: [],
    },
    {
      profileId: createdProfiles[3].id, // Emma (student)
      eventId: summerCamp.id,
      shirtSize: ShirtSize.S,
      swimming: true,
      selfPay: true,
      paid: false,
      medications: ["Ventolin inhaler"],
      allergies: ["Pollen"],
      room: "B205",
      group: "CityLight",
    },
    {
      profileId: createdProfiles[4].id, // Jake (student)
      eventId: summerCamp.id,
      shirtSize: ShirtSize.L,
      swimming: true,
      selfPay: true,
      paid: true,
      medications: [],
      allergies: [],
      room: "A103",
      group: "CityLight",
    },
    {
      profileId: createdProfiles[5].id, // Olivia (student)
      eventId: winterRetreat.id,
      shirtSize: ShirtSize.M,
      swimming: false,
      selfPay: true,
      paid: false,
      medications: [],
      allergies: [],
      room: "Cabin 3",
      group: "Harbour",
    },
    {
      profileId: createdProfiles[6].id, // Liam (student)
      eventId: worshipNight.id,
      shirtSize: ShirtSize.M,
      swimming: false,
      selfPay: false,
      paid: false,
      medications: [],
      allergies: ["Gluten"],
    },
    {
      profileId: createdProfiles[0].id, // John (admin)
      eventId: worshipNight.id,
      shirtSize: ShirtSize.L,
      swimming: false,
      selfPay: false,
      paid: false,
      medications: [],
      allergies: [],
    },
    {
      profileId: createdProfiles[2].id, // Mike (leader)
      eventId: winterRetreat.id,
      shirtSize: ShirtSize.XL,
      swimming: false,
      selfPay: false,
      paid: true,
      medications: [],
      allergies: [],
      room: "Cabin 1",
      group: "Harbour",
    },
  ];

  for (const reg of registrationsData) {
    await prisma.registration.create({ data: reg });
  }

  console.log("Registrations created");
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
