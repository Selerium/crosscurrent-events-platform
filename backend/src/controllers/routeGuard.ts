import express from "express";
import meHandler from "./me.ts";
import checkTokens from "../middleware/checkTokens.ts";

const protectedRouter = express.Router();

protectedRouter.use(checkTokens)
protectedRouter.use('/me', meHandler)

export default protectedRouter;