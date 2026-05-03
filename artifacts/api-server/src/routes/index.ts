import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import reviewRouter from "./review";
import publicConfigRouter from "./public-config";
import pricingConfigRouter from "./pricing-config";
import billingRouter from "./billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(publicConfigRouter);
router.use(pricingConfigRouter);
router.use(billingRouter);

// Dev-only Claude code-review endpoint. Mounted only when NODE_ENV !==
// "production" so it never ships to live traffic. The handler also self-checks
// the env as defense-in-depth.
if (process.env.NODE_ENV !== "production") {
  router.use(reviewRouter);
}

export default router;
