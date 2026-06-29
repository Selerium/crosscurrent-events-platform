import express from "express";
import meHandler from "./postAuth/me.ts";
import meEventsHandler from "./postAuth/meEvents.ts";
import profileHandler from "./postAuth/profile.ts";
import firstTimeHandler from "./postAuth/firstTime.ts";
import eventsHandler from "./events.ts";
import churchHandler from "./churches.ts";
import adminEventsHandler from "./admin/events.ts";
import adminChurchesHandler from "./admin/churches.ts";
import checkTokens from "../middleware/checkTokens.ts";
import requireAdmin from "../middleware/requireAdmin.ts";

const protectedRouter = express.Router();

const adminRouter = express.Router();
adminRouter.use(requireAdmin);
adminRouter.use('/events', adminEventsHandler);
adminRouter.use('/churches', adminChurchesHandler);

protectedRouter.use(checkTokens)
protectedRouter.use('/me', meHandler)
protectedRouter.use('/me/events', meEventsHandler)
protectedRouter.use('/profile', profileHandler)
protectedRouter.use('/profile/first-time', firstTimeHandler)
protectedRouter.use('/churches', churchHandler)
protectedRouter.use('/events', eventsHandler)
protectedRouter.use('/admin', adminRouter)

export default protectedRouter;
