import { Router, Request, Response } from "express";
import { query } from "../database";
import { authenticate, AuthRequest } from "../middleware/auth";
import { uploadBanner } from "../middleware/upload";

const router = Router();

// Get user profile customization
router.get("/customization", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const result = await query(
      `SELECT * FROM user_profile_customization WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({
        user_id: userId,
        banner_url: null,
        bio: null,
        accent_color: null,
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile customization" });
  }
});

// Upload banner
router.post("/banner", authenticate, uploadBanner.single("banner"), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const bannerUrl = `/uploads/banners/${req.file.filename}`;

    // Check if customization exists
    const existing = await query(
      `SELECT * FROM user_profile_customization WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      // Create new customization
      await query(
        `INSERT INTO user_profile_customization (user_id, banner_url) VALUES ($1, $2)`,
        [userId, bannerUrl]
      );
    } else {
      // Update existing customization
      await query(
        `UPDATE user_profile_customization SET banner_url = $1, updated_at = NOW() WHERE user_id = $2`,
        [bannerUrl, userId]
      );
    }

    // Return updated customization
    const result = await query(
      `SELECT * FROM user_profile_customization WHERE user_id = $1`,
      [userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to upload banner" });
  }
});

// Update user profile customization
router.put("/customization", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { banner_url, bio, accent_color } = req.body;

    // Check if customization exists
    const existing = await query(
      `SELECT * FROM user_profile_customization WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows.length === 0) {
      // Create new customization
      await query(
        `INSERT INTO user_profile_customization (user_id, banner_url, bio, accent_color)
         VALUES ($1, $2, $3, $4)`,
        [userId, banner_url || null, bio || null, accent_color || null]
      );
    } else {
      // Update existing customization
      await query(
        `UPDATE user_profile_customization 
         SET banner_url = COALESCE($1, banner_url),
             bio = COALESCE($2, bio),
             accent_color = COALESCE($3, accent_color),
             updated_at = NOW()
         WHERE user_id = $4`,
        [banner_url, bio, accent_color, userId]
      );
    }

    // Return updated customization
    const result = await query(
      `SELECT * FROM user_profile_customization WHERE user_id = $1`,
      [userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile customization" });
  }
});

// Get user profile with customization
router.get("/:userId", authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const userResult = await query(
      `SELECT id, username, discriminator, avatar, status, created_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const customizationResult = await query(
      `SELECT * FROM user_profile_customization WHERE user_id = $1`,
      [userId]
    );

    const user = userResult.rows[0];
    const customization = customizationResult.rows[0] || {
      banner_url: null,
      bio: null,
      accent_color: null,
    };

    res.json({
      ...user,
      customization,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

export { router as profileRoutes };

