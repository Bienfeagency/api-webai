// routes/admin/themes.js
import express from "express";
import { 
  getAllThemes, 
  getThemeById, 
  createTheme, 
  updateTheme, 
  toggleThemeStatus, 
  deleteTheme,
  getThemeStats,
  initializeThemes
} from "../controllers/adminThemeController.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = express.Router();

router.get("/", requireAdmin, getAllThemes);
router.get("/stats", requireAdmin, getThemeStats);
router.get("/:id", requireAdmin, getThemeById);
router.post("/", requireAdmin, createTheme);
router.put("/:id", requireAdmin, updateTheme);
router.patch("/:id/toggle", requireAdmin, toggleThemeStatus);
router.delete("/:id", requireAdmin, deleteTheme);
router.post("/initialize", requireAdmin, initializeThemes);

export default router;