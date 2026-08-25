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

export const sendAdminAccountEmail = async (
  to: string,
  options: { adminName: string; loginUrl: string }
) => {
  const { adminName, loginUrl } = options;

  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] admin account notice for ${to}`);
  }

  const { data, error } = await resend.emails.send({
    from: "do-not-reply@crosscurrent.ae",
    to,
    subject: "Your admin account | CrossCurrent",
    text: `Hi ${adminName},\n\nYou have been given an administrator account on CrossCurrent. Sign in at ${loginUrl} to access the admin dashboard.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2 style="color: #1a1a1a;">You have been given admin access</h2>
        <p style="color: #333;">Hi ${adminName},</p>
        <p style="color: #333;">
          An administrator account has been created for you on CrossCurrent.
          You can now sign in and access the admin dashboard.
        </p>
        <a href="${loginUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background-color: #525252; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Go to admin dashboard
        </a>
        <p style="color: #555; font-size: 14px;">
          Or copy and paste this link into your browser:<br />
          <a href="${loginUrl}">${loginUrl}</a>
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
};

export type ChurchApplicationEmailOptions = {
  applicantName: string;
  applicantRole: string;
  churchName: string;
};

const reviewLink = () => {
  const base = process.env.FRONTEND_URL || "http://localhost:3000";
  return `${base}/my-church`;
};

export const sendChurchApplicationEmail = async (
  to: string,
  options: ChurchApplicationEmailOptions
) => {
  const { applicantName, applicantRole, churchName } = options;
  const link = reviewLink();

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[email] church application notice for ${to}: ${applicantName} applied to ${churchName}`
    );
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "do-not-reply@crosscurrent.ae",
      to,
      subject: `New application to ${churchName} | CrossCurrent`,
      text: `${applicantName} (${applicantRole}) has applied to join ${churchName}. Please review their application on your dashboard: ${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px;">
          <h2 style="color: #1a1a1a;">New church application</h2>
          <p style="color: #333;">
            <strong>${applicantName}</strong> (${applicantRole}) has applied to join
            <strong>${churchName}</strong>.
          </p>
          <a href="${link}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background-color: #525252; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Review application
          </a>
          <p style="color: #555; font-size: 14px;">
            Or copy and paste this link into your browser:<br />
            <a href="${link}">${link}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    console.error(`[email] failed to send church application notice to ${to}:`, err);
  }
};

export type ScholarshipRequestEmailOptions = {
  studentName: string;
  eventName: string;
  eventDates: string;
};

export const sendScholarshipRequestEmail = async (
  to: string,
  options: ScholarshipRequestEmailOptions
) => {
  const { studentName, eventName, eventDates } = options;
  const link = reviewLink();

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[email] scholarship request notice for ${to}: ${studentName} requested a scholarship for ${eventName}`
    );
  }

  try {
    const { data, error } = await resend.emails.send({
      from: "do-not-reply@crosscurrent.ae",
      to,
      subject: `Scholarship request for ${eventName} | CrossCurrent`,
      text: `${studentName} has requested a scholarship for ${eventName} (${eventDates}). Please review the request on your dashboard: ${link}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 24px;">
          <h2 style="color: #1a1a1a;">Scholarship request</h2>
          <p style="color: #333;">
            <strong>${studentName}</strong> has requested a scholarship for
            <strong>${eventName}</strong> (${eventDates}).
          </p>
          <a href="${link}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background-color: #525252; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
            Review request
          </a>
          <p style="color: #555; font-size: 14px;">
            Or copy and paste this link into your browser:<br />
            <a href="${link}">${link}</a>
          </p>
        </div>
      `,
    });

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    console.error(`[email] failed to send scholarship request notice to ${to}:`, err);
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

export const sendPasswordResetEmail = async (
  to: string,
  resetUrl: string
) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] password reset link for ${to}: ${resetUrl}`);
  }

  const { data, error } = await resend.emails.send({
    from: "do-not-reply@crosscurrent.ae",
    to,
    subject: "Reset your password | CrossCurrent",
    text: `You requested a password reset. Please open this link to set a new password: ${resetUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px;">
        <h2 style="color: #1a1a1a;">Reset your password</h2>
        <p style="color: #333;">We received a request to reset the password for your CrossCurrent account.</p>
        <a href="${resetUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background-color: #525252; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Reset password
        </a>
        <p style="color: #555; font-size: 14px;">
          Or copy and paste this link into your browser:<br />
          <a href="${resetUrl}">${resetUrl}</a>
        </p>
        <p style="color: #777; font-size: 12px;">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message);
  }
};
