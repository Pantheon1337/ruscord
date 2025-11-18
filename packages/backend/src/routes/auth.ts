import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { query } from "../database";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  username: z.string().min(2).max(32),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Register
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = registerSchema.parse(req.body);

    // Check if user exists
    const existingUser = await query(
      "SELECT id FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Generate unique discriminator (globally unique, not per username)
    // Find the lowest available discriminator
    let discriminator = "0001";
    let attempts = 0;
    const maxAttempts = 10000;

    while (attempts < maxAttempts) {
      const existingResult = await query(
        "SELECT id FROM users WHERE discriminator = $1",
        [discriminator]
      );

      if (existingResult.rows.length === 0) {
        // This discriminator is available
        break;
      }

      // Try next discriminator
      const currentNum = parseInt(discriminator);
      if (currentNum >= 9999) {
        return res.status(400).json({ error: "Cannot generate unique discriminator" });
      }
      discriminator = String(currentNum + 1).padStart(4, "0");
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return res.status(400).json({ error: "Cannot generate unique discriminator" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await query(
      `INSERT INTO users (id, username, discriminator, email, password_hash)
       VALUES (gen_random_uuid(), $1, $2, $3, $4)
       RETURNING id, username, discriminator, email, avatar, status, created_at`,
      [username, discriminator, email, passwordHash]
    );

    const user = result.rows[0];

    // Initialize currency for new user
    await query(
      `INSERT INTO user_currency (user_id, rucoin_amount) VALUES ($1, 1000)`,
      [user.id]
    );

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user
    const result = await query(
      "SELECT id, username, discriminator, email, password_hash, avatar, status FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({
      user: {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        email: user.email,
        avatar: user.avatar,
        status: user.status,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export { router as authRoutes };

