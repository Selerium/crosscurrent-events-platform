import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"

import registerHandler from "./controllers/register.ts";
import loginHandler from "./controllers/login.ts";
import errorHandler from "./middleware/errorHandler.ts";
import meHandler from "./controllers/me.ts";
import checkTokens from "./middleware/checkTokens.ts";
import protectedRouter from "./controllers/routeGuard.ts";

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
app.use("/api", protectedRouter)
app.use(errorHandler);

export default app;
