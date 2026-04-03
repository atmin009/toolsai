import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { requireAuth } from "../middleware/auth";
import * as topics from "../controllers/topic.controller";

export const topicRouter = Router();

topicRouter.use(requireAuth);

topicRouter.get("/", asyncHandler(topics.listTopics));
topicRouter.post("/manual", asyncHandler(topics.createManualTopic));
topicRouter.post("/bulk-approve", asyncHandler(topics.bulkApprove));
topicRouter.post("/bulk-regenerate", asyncHandler(topics.bulkRegenerate));
topicRouter.post("/bulk-delete", asyncHandler(topics.bulkDelete));
topicRouter.get("/:id", asyncHandler(topics.getTopic));
topicRouter.patch("/:id", asyncHandler(topics.updateTopic));
topicRouter.post("/:id/approve", asyncHandler(topics.approveTopic));
topicRouter.delete("/:id", asyncHandler(topics.rejectTopic));
topicRouter.post("/:id/regenerate", asyncHandler(topics.regenerateTopic));
