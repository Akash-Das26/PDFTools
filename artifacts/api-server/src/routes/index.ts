import { Router, type IRouter } from "express";
import healthRouter from "./health";
import toolsRouter from "./tools";
import jobsRouter from "./jobs";
import pdfRouter from "./pdf";

const router: IRouter = Router();

router.use(healthRouter);
router.use(toolsRouter);
router.use(jobsRouter);
router.use(pdfRouter);

export default router;
