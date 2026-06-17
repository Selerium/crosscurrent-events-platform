"use server";

import { z } from "zod";
import { backendFetchWithAuthCookies } from "@/lib/auth/backendFetchWithAuthCookies";

const registerSchema = z
  .object({
    email: z.email(),
    fullName: z.string(),
    password: z.string().min(8, "password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(8, "password must be at least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "passwords do not match",
  });

export async function submitRegisterForm(prevState: any, formData: FormData) {
  try {
    const rawData = Object.fromEntries(formData.entries())
    const validatedData = registerSchema.parse(rawData);

    const res = await backendFetchWithAuthCookies(
      `${process.env.NEXT_PUBLIC_API_URL}/register`,
      {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validatedData),
      },
    );

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, message: data?.message ?? "Failed to create user" };
    }

    return { success: true, data };
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { success: false, message: "Incorrect data in form fields" };
    } else {
      return { success: false, message: "Failed to create user" };
    }
  }
}
