import express from "express";
import { getUserSites } from "../controllers/userSitesController.js";
import authMiddleware from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get("/user/sites", authMiddleware, getUserSites);

export default router;
