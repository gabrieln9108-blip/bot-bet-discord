import { Router, type IRouter } from "express";
import healthRouter from "./health";
import firstEmploymentRouter from "./first-employment";
import commerceRouter from "./commerce";

const router: IRouter = Router();

router.use(healthRouter);
router.use(commerceRouter);
router.use(firstEmploymentRouter);

export default router;
