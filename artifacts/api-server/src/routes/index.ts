import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import teachersRouter from "./teachers";
import groupsRouter from "./groups";
import studentsRouter from "./students";
import statsRouter from "./stats";
import deployRouter from "./deploy";
import employeesRouter from "./employees";
import payrollsRouter from "./payrolls";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(teachersRouter);
router.use(groupsRouter);
router.use(studentsRouter);
router.use(statsRouter);
router.use(deployRouter);
router.use(employeesRouter);
router.use(payrollsRouter);

export default router;
