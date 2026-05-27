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
import ssRouter from "./ss";
import settingsRouter from "./settings";
import resetPasswordRouter from "./reset-password";
import activityRouter from "./activity";
import teamsRouter from "./teams";
import teacherPanelRouter from "./teacher-panel";

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
router.use(ssRouter);
router.use(settingsRouter);
router.use(resetPasswordRouter);
router.use(activityRouter);
router.use(teamsRouter);
router.use(teacherPanelRouter);

export default router;
