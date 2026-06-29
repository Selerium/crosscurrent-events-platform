export type EventStatus = "active" | "closed";

export type AdminEvent = {
  id: string;
  name: string;
  brief: string;
  startDate: string;
  endDate: string;
  location: string;
  status: EventStatus;
  signUps: number;
  capacity: number;
  price: number;
  revenue: number;
  schedule: {
    item: string;
    description: string;
    startTime: string;
    endTime: string;
    location: string;
  }[][];
};

export type ChurchRecord = {
  id: string;
  name: string;
  emirate: string;
  members: number;
  primaryContact: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
};

export const adminEvents: AdminEvent[] = [
  {
    id: "1",
    name: "Big Weekend 2026",
    brief:
      "UAEYFC's annual 3-day weekend youth retreat for teens and leaders across the UAE.",
    startDate: "2026-09-18",
    endDate: "2026-09-20",
    location: "Ras Al Khaimah",
    status: "active",
    signUps: 184,
    capacity: 300,
    price: 530,
    revenue: 97520,
    schedule: [
      [
        {
          item: "Arrival and check-in",
          description: "Groups arrive, collect room keys, and meet their leaders.",
          startTime: "16:00",
          endTime: "18:00",
          location: "Main Lobby",
        },
        {
          item: "Opening session",
          description: "Welcome, worship, and orientation for the weekend.",
          startTime: "19:30",
          endTime: "21:00",
          location: "Main Hall",
        },
      ],
      [
        {
          item: "Morning gathering",
          description: "Teaching, worship, and group discussion.",
          startTime: "09:00",
          endTime: "11:00",
          location: "Main Hall",
        },
        {
          item: "Team challenges",
          description: "Outdoor activities by colour group.",
          startTime: "15:00",
          endTime: "17:00",
          location: "Activity Field",
        },
      ],
      [
        {
          item: "Closing celebration",
          description: "Final session, awards, and send-off.",
          startTime: "10:00",
          endTime: "12:00",
          location: "Main Hall",
        },
      ],
    ],
  },
  {
    id: "2",
    name: "Leaders Summit",
    brief: "A one-day training event for youth leaders and church volunteers.",
    startDate: "2026-11-07",
    endDate: "2026-11-07",
    location: "Dubai",
    status: "active",
    signUps: 72,
    capacity: 120,
    price: 300,
    revenue: 21600,
    schedule: [
      [
        {
          item: "Keynote",
          description: "Leading teams with clarity and care.",
          startTime: "09:30",
          endTime: "10:30",
          location: "Auditorium",
        },
        {
          item: "Breakout workshops",
          description: "Practical training for small group leaders.",
          startTime: "11:00",
          endTime: "13:00",
          location: "Training Rooms",
        },
      ],
    ],
  },
  {
    id: "3",
    name: "Winter Camp",
    brief: "Four days of worship, games, small groups, and shared meals.",
    startDate: "2026-12-12",
    endDate: "2026-12-15",
    location: "Fujairah",
    status: "active",
    signUps: 96,
    capacity: 180,
    price: 530,
    revenue: 50880,
    schedule: [
      [
        {
          item: "Camp welcome",
          description: "Registration and opening night programme.",
          startTime: "17:00",
          endTime: "21:00",
          location: "Camp Centre",
        },
      ],
      [
        {
          item: "Beach games",
          description: "Morning activities and team games.",
          startTime: "09:00",
          endTime: "11:30",
          location: "Beachfront",
        },
      ],
    ],
  },
  {
    id: "4",
    name: "Spring Youth Night",
    brief: "An evening gathering for youth groups across the city.",
    startDate: "2026-03-21",
    endDate: "2026-03-21",
    location: "Sharjah",
    status: "closed",
    signUps: 142,
    capacity: 160,
    price: 75,
    revenue: 10650,
    schedule: [
      [
        {
          item: "Youth night",
          description: "Games, worship, message, and dinner.",
          startTime: "18:00",
          endTime: "21:30",
          location: "Main Auditorium",
        },
      ],
    ],
  },
];

export const churches: ChurchRecord[] = [
  {
    id: "1",
    name: "CrossCurrent Church Dubai",
    emirate: "Dubai",
    members: 128,
    primaryContact: "Maya Fernandes",
    contactEmail: "maya@crosscurrent.ae",
    contactPhone: "+971 50 123 4567",
    address: "Al Quoz, Dubai",
  },
  {
    id: "2",
    name: "Grace Fellowship Abu Dhabi",
    emirate: "Abu Dhabi",
    members: 84,
    primaryContact: "Daniel Thomas",
    contactEmail: "daniel@gracefellowship.ae",
    contactPhone: "+971 50 222 7788",
    address: "Mussafah, Abu Dhabi",
  },
  {
    id: "3",
    name: "RAK Community Church",
    emirate: "Ras Al Khaimah",
    members: 56,
    primaryContact: "Sarah Mathew",
    contactEmail: "sarah@rakcommunity.ae",
    contactPhone: "+971 55 333 9811",
    address: "Al Nakheel, Ras Al Khaimah",
  },
  {
    id: "4",
    name: "Sharjah City Fellowship",
    emirate: "Sharjah",
    members: 63,
    primaryContact: "Joel Abraham",
    contactEmail: "joel@sharjahfellowship.ae",
    contactPhone: "+971 52 440 1900",
    address: "Al Majaz, Sharjah",
  },
];

export const currencyFormatter = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

export function formatEventDate(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (startDate === endDate) {
    return formatter.format(start);
  }

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}
