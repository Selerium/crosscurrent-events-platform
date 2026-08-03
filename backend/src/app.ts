import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import bcrypt from "bcryptjs";

import registerHandler from "./controllers/register.ts";
import loginHandler from "./controllers/login.ts";
import emailVerificationHandler from "./controllers/emailVerification.ts";
import parentVerificationHandler from "./controllers/parentVerification.ts";
import errorHandler from "./middleware/errorHandler.ts";
import protectedRouter from "./controllers/routeGuard.ts";
import webhookHandler from "./controllers/webhook.ts";
import { prisma } from "./lib/prismaClient.ts";

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use("/webhooks", webhookHandler);
app.use(express.json());
app.use(cookieParser());

app.get("/test", (req, res) => {
  res.json({
    data: req.body,
    message: "Backend connection works",
    error: false,
  });
});

app.use("/register", registerHandler);
app.use("/login", loginHandler);
app.use("/verify-email", emailVerificationHandler);
app.use("/parent-verify", parentVerificationHandler);
app.post("/logout", async (req, res) => {
  const refreshToken = req.cookies.refresh_token;
  if (refreshToken) {
    const storedTokens = await prisma.refreshTokens.findMany({
      where: { revokedAt: null },
    });
    for (const stored of storedTokens) {
      const match = await bcrypt.compare(refreshToken, stored.tokenHash);
      if (match) {
        await prisma.refreshTokens.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        break;
      }
    }
  }
  res.clearCookie("access_token", { path: "/", domain: process.env.COOKIE_DOMAIN ?? undefined });
  res.clearCookie("refresh_token", { path: "/", domain: process.env.COOKIE_DOMAIN ?? undefined });
  res.json({ data: {}, message: "Logged out", error: false });
});
app.use("", protectedRouter)
app.use(errorHandler);

export default app;
