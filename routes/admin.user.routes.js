import express from "express";
import { 
  getAllUsers, 
  getUserById, 
  createUser, 
  updateUser, 
  deleteUser 
} from "../controllers/adminUserController.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

const router = express.Router();

router.get("/", requireAdmin, getAllUsers);
router.get("/:id", requireAdmin, getUserById);
router.post("/", requireAdmin, createUser);
router.put("/:id", requireAdmin, updateUser);
router.delete("/:id", requireAdmin, deleteUser);

export default router;