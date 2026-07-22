export type EventStatus = "active" | "closed" | "completed";

export type AdminEvent = {
  id: string;
  name: string;
  brief: string;
  startDate: string;
  endDate: string;
  location: string;
  status: EventStatus;
  signUps: number;
  paidSignUps: number;
  unpaidSignUps: number;
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
  country: string;
  state: string;
  emirate: string;
  members: number;
  primaryContact: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
};

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
