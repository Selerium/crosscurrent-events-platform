export type EventRegistrationAudience = "ALL" | "STUDENTS" | "LEADERS";

export const REGISTRATION_AUDIENCE_LABELS: Record<
  EventRegistrationAudience,
  string
> = {
  ALL: "All",
  STUDENTS: "Students only",
  LEADERS: "Leaders only",
};
