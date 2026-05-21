import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analyzeRouter from "./analyze";
import generateRouter from "./generate";
import companionRouter from "./companion";
import featureRouter from "./feature";
import launchRouter from "./launch";
import projectsRouter from "./projects";
import tierRouter from "./tier";
import renderRouter from "./render";
import scoreRouter from "./score";
import debugRouter from "./debug";
import stripeRouter from "./stripe";
import usageRouter from "./usage";
import onboardingRouter from "./onboarding";
import adminBootstrapRouter from "./adminBootstrap";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analyzeRouter);
router.use(generateRouter);
router.use(companionRouter);
router.use(featureRouter);
router.use(launchRouter);
router.use(projectsRouter);
router.use(tierRouter);
router.use(renderRouter);
router.use(scoreRouter);
router.use(debugRouter);
router.use(stripeRouter);
router.use(usageRouter);
router.use(onboardingRouter);
router.use(adminBootstrapRouter);

export default router;
