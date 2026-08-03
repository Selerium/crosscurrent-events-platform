import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (
  to: string,
  verificationUrl: string
) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] verification link for ${to}: ${verificationUrl}`);
  }

  const { data, error } = await resend.emails.send({
    from: "do-not-reply@crosscurrent.ae",
    to,
    subject: "Verify your email | CrossCurrent",
    text: `Welcome to CrossCurrent! Please verify your email address by opening this link: ${verificationUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2 style="color: #1a1a1a;">Verify your email</h2>
        <p style="color: #333;">Welcome to CrossCurrent! Please confirm your email address to activate your account.</p>
        <a href="${verificationUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background-color: #525252; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Verify email
        </a>
        <p style="color: #555; font-size: 14px;">
          Or copy and paste this link into your browser:<br />
          <a href="${verificationUrl}">${verificationUrl}</a>
        </p>
        <p style="color: #777; font-size: 12px;">This link expires in 24 hours.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export type ParentVerificationOptions = {
  eventName: string;
  eventDates: string;
  studentName: string;
  shirtSize: string;
  swimming: boolean;
  swimmingPermission: boolean;
  selfPay: boolean;
  mediaConsent: boolean;
  medications: string[];
  allergies: string[];
  emergencyName: string;
  emergencyPhone: string;
  notes: string;
};

const optionRow = (label: string, value: string) =>
  `<tr>
    <td style="padding: 6px 12px; border-bottom: 1px solid #eee; color: #555; font-size: 14px;">${label}</td>
    <td style="padding: 6px 12px; border-bottom: 1px solid #eee; color: #1a1a1a; font-size: 14px; font-weight: bold;">${value}</td>
  </tr>`;

export const sendParentVerificationEmail = async (
  to: string,
  options: ParentVerificationOptions,
  verificationUrl: string
) => {
  const list = (items: string[], fallback: string) =>
    items.length > 0 ? items.join(", ") : fallback;

  const rows = [
    optionRow("Event", options.eventName),
    optionRow("Event dates", options.eventDates),
    optionRow("Student", options.studentName),
    optionRow("Shirt size", options.shirtSize),
    optionRow("Swimming", options.swimming ? "Yes" : "No"),
    options.swimmingPermission
      ? optionRow("Swimming permission granted", "Yes")
      : "",
    optionRow("Payment", options.selfPay ? "Requesting scholarship" : "Paying"),
    optionRow(
      "Media consent",
      options.mediaConsent ? "Granted" : "Not granted"
    ),
    optionRow("Medications", list(options.medications, "None")),
    optionRow("Allergies/Dietary restrictions", list(options.allergies, "None")),
    options.emergencyName
      ? optionRow(
          "Emergency contact",
          `${options.emergencyName}${options.emergencyPhone ? ` (${options.emergencyPhone})` : ""}`
        )
      : "",
    options.notes ? optionRow("Notes", options.notes) : "",
  ].join("");

  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] parent verification link for ${to}: ${verificationUrl}`);
  }

  const { data, error } = await resend.emails.send({
    from: "do-not-reply@crosscurrent.ae",
    to,
    subject: `Registration approval needed for ${options.eventName} | CrossCurrent`,
    text: `Hi, this is a notice that ${options.studentName} has registered for ${options.eventName} (${options.eventDates}) and selected the following options:

Shirt size: ${options.shirtSize}
Swimming: ${options.swimming ? "Yes" : "No"}
Payment: ${options.selfPay ? "Requesting scholarship" : "Paying"}
Medications: ${list(options.medications, "None")}
Allergies/Dietary restrictions: ${list(options.allergies, "None")}

Please approve this registration by opening this link: ${verificationUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2 style="color: #1a1a1a;">Registration approval needed</h2>
        <p style="color: #333;">
          ${options.studentName} has registered for <strong>${options.eventName}</strong>
          (${options.eventDates}) and selected the following options:
        </p>
        <table style="border-collapse: collapse; margin: 16px 0; width: 100%; max-width: 480px;">
          ${rows}
        </table>
        <a href="${verificationUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background-color: #525252; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Approve registration
        </a>
        <p style="color: #555; font-size: 14px;">
          Or copy and paste this link into your browser:<br />
          <a href="${verificationUrl}">${verificationUrl}</a>
        </p>
        <p style="color: #777; font-size: 12px;">This link expires in 7 days.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
};
