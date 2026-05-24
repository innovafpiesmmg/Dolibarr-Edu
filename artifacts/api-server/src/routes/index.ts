import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teachersRouter from "./teachers";
import groupsRouter from "./groups";
import studentsRouter from "./students";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(teachersRouter);
router.use(groupsRouter);
router.use(studentsRouter);
router.use(statsRouter);

export default router;
