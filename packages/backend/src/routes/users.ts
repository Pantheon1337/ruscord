import { Router } from "express";
import { authenticate, AuthRequest } from "../middleware/auth";
import { query } from "../database";
import { uploadAvatar } from "../middleware/upload";
import path from "path";

const router = Router();
router.use(authenticate);

// Get current user
router.get("/me", async (req: AuthRequest, res) => {
  try {
    const result = await query(
      "SELECT id, username, discriminator, email, avatar, status, created_at FROM users WHERE id = $1",
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload avatar
router.post("/me/avatar", uploadAvatar.single("avatar"), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Update user avatar
    const result = await query(
      `UPDATE users SET avatar = $1, updated_at = NOW() WHERE id = $2 RETURNING id, username, discriminator, email, avatar, status, created_at`,
      [avatarUrl, req.userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Upload avatar error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update current user
router.patch("/me", async (req: AuthRequest, res) => {
  try {
    const { username } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (username !== undefined) {
      // Check if username is already taken
      const existingUser = await query(
        "SELECT id FROM users WHERE username = $1 AND discriminator = (SELECT discriminator FROM users WHERE id = $2) AND id != $2",
        [username, req.userId]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: "Username already taken" });
      }

      updates.push(`username = $${paramIndex++}`);
      values.push(username);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.userId);

    const result = await query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex} RETURNING id, username, discriminator, email, avatar, status, created_at`,
      values
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user by ID
router.get("/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      "SELECT id, username, discriminator, avatar, status FROM users WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as userRoutes };

