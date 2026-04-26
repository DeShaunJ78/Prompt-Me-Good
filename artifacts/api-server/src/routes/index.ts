import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import reviewRouter from "./review";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);

// Dev-only Claude code-review endpoint. Mounted only when NODE_ENV !==
// "production" so it never ships to live traffic. The handler also self-checks
// the env as defense-in-depth.
if (process.env.NODE_ENV !== "production") {
  router.use(reviewRouter);
}

export default router;
