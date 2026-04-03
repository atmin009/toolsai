import { Router } from "express";
import { authRouter } from "./auth.routes";
import { websiteRouter } from "./website.routes";
import { plannerRouter } from "./planner.routes";
import { topicRouter } from "./topic.routes";
import { articleRouter } from "./article.routes";
import { dashboardRouter } from "./dashboard.routes";
import { settingsRouter } from "./settings.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/websites", websiteRouter);
apiRouter.use("/planner", plannerRouter);
apiRouter.use("/topics", topicRouter);
apiRouter.use("/articles", articleRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/settings", settingsRouter);
