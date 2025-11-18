import { Router, Request, Response } from "express";
import { query } from "../database";
import { authenticate, AuthRequest } from "../middleware/auth";
import { uploadBanner } from "../middleware/upload";

const router = Router();

// Get all shop items
router.get("/items", authenticate, async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM shop_items WHERE is_active = true ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch shop items" });
  }
});

// Get user's currency balance
router.get("/currency", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const result = await query(
      `SELECT rucoin_amount FROM user_currency WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Initialize currency if not exists
      await query(
        `INSERT INTO user_currency (user_id, rucoin_amount) VALUES ($1, 1000)`,
        [userId]
      );
      return res.json({ rucoin_amount: 1000 });
    }

    res.json({ rucoin_amount: result.rows[0].rucoin_amount });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch currency" });
  }
});

// Purchase item
router.post("/purchase", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required" });
    }

    // Check if item exists and is active
    const itemResult = await query(
      `SELECT * FROM shop_items WHERE id = $1 AND is_active = true`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: "Item not found" });
    }

    const item = itemResult.rows[0];

    // Check if user already owns the item
    const purchaseCheck = await query(
      `SELECT * FROM user_purchases WHERE user_id = $1 AND item_id = $2`,
      [userId, itemId]
    );

    if (purchaseCheck.rows.length > 0) {
      return res.status(400).json({ error: "Item already purchased" });
    }

    // Get user's currency
    const currencyResult = await query(
      `SELECT rucoin_amount FROM user_currency WHERE user_id = $1`,
      [userId]
    );

    let currentBalance = 0;
    if (currencyResult.rows.length === 0) {
      // Initialize currency
      await query(
        `INSERT INTO user_currency (user_id, rucoin_amount) VALUES ($1, 1000)`,
        [userId]
      );
      currentBalance = 1000;
    } else {
      currentBalance = parseInt(currencyResult.rows[0].rucoin_amount);
    }

    // Check if user has enough currency
    if (currentBalance < item.price) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    // Deduct currency and record purchase
    await query(`BEGIN`);
    try {
      await query(
        `UPDATE user_currency SET rucoin_amount = rucoin_amount - $1, updated_at = NOW() WHERE user_id = $2`,
        [item.price, userId]
      );

      await query(
        `INSERT INTO user_purchases (user_id, item_id) VALUES ($1, $2)`,
        [userId, itemId]
      );

      await query(`COMMIT`);

      // Get updated balance
      const updatedCurrency = await query(
        `SELECT rucoin_amount FROM user_currency WHERE user_id = $1`,
        [userId]
      );

      res.json({
        success: true,
        item: item,
        new_balance: updatedCurrency.rows[0].rucoin_amount,
      });
    } catch (error) {
      await query(`ROLLBACK`);
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to purchase item" });
  }
});

// Get user's purchased items
router.get("/purchases", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const result = await query(
      `SELECT 
        up.id,
        up.purchased_at,
        si.id as item_id,
        si.name,
        si.description,
        si.type,
        si.image_url,
        si.rarity
      FROM user_purchases up
      JOIN shop_items si ON up.item_id = si.id
      WHERE up.user_id = $1
      ORDER BY up.purchased_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch purchases" });
  }
});

// Apply banner to profile
router.post("/apply-banner", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: "Item ID is required" });
    }

    // Check if user owns the item
    const purchaseCheck = await query(
      `SELECT * FROM user_purchases WHERE user_id = $1 AND item_id = $2`,
      [userId, itemId]
    );

    if (purchaseCheck.rows.length === 0) {
      return res.status(403).json({ error: "You don't own this item" });
    }

    // Get item details
    const itemResult = await query(
      `SELECT * FROM shop_items WHERE id = $1 AND type = 'banner'`,
      [itemId]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: "Banner not found" });
    }

    const bannerUrl = itemResult.rows[0].image_url;

    // Update or insert user profile customization
    await query(
      `INSERT INTO user_profile_customization (user_id, banner_url, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET banner_url = $2, updated_at = NOW()`,
      [userId, bannerUrl]
    );

    res.json({ success: true, banner_url: bannerUrl });
  } catch (error) {
    console.error("Apply banner error:", error);
    res.status(500).json({ error: "Failed to apply banner" });
  }
});

// Admin: Update user currency
router.post("/admin/currency", authenticate, async (req: Request, res: Response) => {
  try {
    const adminUserId = (req as AuthRequest).userId;
    
    // Check if user is admin (you can implement proper admin check here)
    // For now, we'll allow any authenticated user to modify currency
    // TODO: Add proper admin role check
    
    const { userId, amount, operation } = req.body; // operation: 'set', 'add', 'subtract'

    if (!userId || amount === undefined) {
      return res.status(400).json({ error: "User ID and amount are required" });
    }

    if (!['set', 'add', 'subtract'].includes(operation)) {
      return res.status(400).json({ error: "Operation must be 'set', 'add', or 'subtract'" });
    }

    // Get current currency
    const currentResult = await query(
      `SELECT rucoin_amount FROM user_currency WHERE user_id = $1`,
      [userId]
    );

    let newAmount = 0;
    if (currentResult.rows.length === 0) {
      // Initialize currency if not exists
      if (operation === 'set') {
        newAmount = parseInt(amount);
      } else if (operation === 'add') {
        newAmount = parseInt(amount);
      } else {
        newAmount = 0;
      }
      
      await query(
        `INSERT INTO user_currency (user_id, rucoin_amount, updated_at) VALUES ($1, $2, NOW())`,
        [userId, newAmount]
      );
    } else {
      const currentAmount = parseInt(currentResult.rows[0].rucoin_amount);
      
      if (operation === 'set') {
        newAmount = parseInt(amount);
      } else if (operation === 'add') {
        newAmount = currentAmount + parseInt(amount);
      } else {
        newAmount = Math.max(0, currentAmount - parseInt(amount));
      }

      await query(
        `UPDATE user_currency SET rucoin_amount = $1, updated_at = NOW() WHERE user_id = $2`,
        [newAmount, userId]
      );
    }

    res.json({ 
      success: true, 
      user_id: userId,
      new_amount: newAmount,
      operation 
    });
  } catch (error) {
    console.error("Update currency error:", error);
    res.status(500).json({ error: "Failed to update currency" });
  }
});

// Upload custom banner (costs 1000 coins)
router.post("/upload-custom-banner", authenticate, uploadBanner.single("banner"), async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const CUSTOM_BANNER_PRICE = 1000;

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Check user's currency
    const currencyResult = await query(
      `SELECT rucoin_amount FROM user_currency WHERE user_id = $1`,
      [userId]
    );

    let currentBalance = 0;
    if (currencyResult.rows.length === 0) {
      return res.status(400).json({ error: "Insufficient funds" });
    } else {
      currentBalance = parseInt(currencyResult.rows[0].rucoin_amount);
    }

    // Check if user has enough currency
    if (currentBalance < CUSTOM_BANNER_PRICE) {
      return res.status(400).json({ error: "Insufficient funds" });
    }

    const bannerUrl = `/uploads/banners/${req.file.filename}`;

    // Deduct currency and save custom banner
    await query(`BEGIN`);
    try {
      // Deduct currency
      await query(
        `UPDATE user_currency SET rucoin_amount = rucoin_amount - $1, updated_at = NOW() WHERE user_id = $2`,
        [CUSTOM_BANNER_PRICE, userId]
      );

      // Save custom banner
      await query(
        `INSERT INTO user_custom_banners (user_id, image_url) VALUES ($1, $2)`,
        [userId, bannerUrl]
      );

      await query(`COMMIT`);

      // Get updated balance
      const updatedCurrency = await query(
        `SELECT rucoin_amount FROM user_currency WHERE user_id = $1`,
        [userId]
      );

      res.json({
        success: true,
        banner_url: bannerUrl,
        new_balance: updatedCurrency.rows[0].rucoin_amount,
      });
    } catch (error) {
      await query(`ROLLBACK`);
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: "Failed to upload custom banner" });
  }
});

// Get user's custom banners
router.get("/custom-banners", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const result = await query(
      `SELECT id, image_url, created_at FROM user_custom_banners WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch custom banners" });
  }
});

export { router as shopRoutes };

