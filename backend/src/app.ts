import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import bcrypt from "bcryptjs";

import registerHandler from "./controllers/register.ts";
import loginHandler from "./controllers/login.ts";
import errorHandler from "./middleware/errorHandler.ts";
import protectedRouter from "./controllers/routeGuard.ts";
import { prisma } from "./lib/prismaClient.ts";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.get("/api/test", (req, res) => {
  res.json({
    data: req.body,
    message: "Backend connection works",
    error: false,
  });
});

app.use("/api/register", registerHandler);
app.use("/api/login", loginHandler);
app.post("/api/logout", async (req, res) => {
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
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/" });
  res.json({ data: {}, message: "Logged out", error: false });
});
app.use("/api", protectedRouter)
app.use(errorHandler);

export default app;
