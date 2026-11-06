import type { CheckInStatus } from "@/lib/checkInStatus";

export type { CheckInStatus };
export { checkInStatusLabel } from "@/lib/checkInStatus";

export type CheckInEvent = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string;
  eventStatus: "OPEN" | "CLOSED" | "COMPLETED";
};

export type CheckInSearchResult = {
  registrationId: string;
  profileId: string;
  name: string;
  role: string;
  gender: string;
  age: number | null;
  church: string;
  checkInStatus: CheckInStatus;
  checkInStatusAt: string | null;
};

export type CheckInLastAction = {
  status: CheckInStatus;
  previousStatus: CheckInStatus;
  actorName: string;
  actorRegistrationId: string | null;
  actorIsAdmin: boolean;
  createdAt: string;
};

export type CheckInDetail = {
  profile: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    gender: string;
    dob: string | null;
    age: number | null;
    ageCategory: string | null;
    nationality: string;
    approved: boolean;
    primaryForChurch: boolean;
    church: { id: string; name: string } | null;
    parentOneName: string;
    parentOneEmail: string;
    parentOnePhone: string;
  };
  registration: {
    id: string;
    event: {
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      location: string;
      status: "OPEN" | "CLOSED" | "COMPLETED";
    };
    paid: boolean;
    paymentMethod: string;
    earlyBird: boolean;
    selfPay: boolean;
    shirtSize: string;
    swimming: boolean;
    swimmingPermission: boolean;
    mediaConsent: boolean;
    room: string;
    group: string;
    hiddenInGroup: boolean;
    spouse: string;
    primaryLeaderRole: string;
    secondaryLeaderRoles: string[];
    medications: string[];
    allergies: string[];
    emergencyName: string;
    emergencyPhone: string;
    notes: string;
    parentVerified: boolean;
    hasSafeguardingDoc: boolean;
    createdAt: string;
  };
  checkIn: {
    status: CheckInStatus;
    statusAt: string | null;
    version: number;
    lastAction: CheckInLastAction | null;
  };
};

export type CheckInStatusUpdate = {
  status: CheckInStatus;
  statusAt: string;
  version: number;
  lastAction: CheckInLastAction;
};

export function formatCheckInDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatEventDateRange(startDate: string, endDate: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const start = formatter.format(new Date(startDate));
  const end = formatter.format(new Date(endDate));
  return startDate === endDate ? start : `${start} - ${end}`;
}
