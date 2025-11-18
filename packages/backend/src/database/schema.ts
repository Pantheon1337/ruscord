import { query } from "./index";

export const createTables = async () => {
  // Users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(32) NOT NULL,
      discriminator VARCHAR(4) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar TEXT,
      status VARCHAR(20) DEFAULT 'offline',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(username, discriminator)
    )
  `);

  // Servers table
  await query(`
    CREATE TABLE IF NOT EXISTS servers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      icon TEXT,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Channels table
  await query(`
    CREATE TABLE IF NOT EXISTS channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Messages table
  // Note: channel_id can reference either channels or dm_channels
  // We don't use a foreign key constraint to allow both types
  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID NOT NULL,
      author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      edited_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Attachments table
  await query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      url TEXT NOT NULL,
      size BIGINT NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Reactions table
  await query(`
    CREATE TABLE IF NOT EXISTS reactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(message_id, user_id, emoji)
    )
  `);

  // Roles table
  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      color INTEGER NOT NULL DEFAULT 0,
      permissions BIGINT NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      mentionable BOOLEAN DEFAULT false,
      hoist BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Members table
  await query(`
    CREATE TABLE IF NOT EXISTS members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      nickname VARCHAR(32),
      joined_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, server_id)
    )
  `);

  // Member roles junction table
  await query(`
    CREATE TABLE IF NOT EXISTS member_roles (
      member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      PRIMARY KEY (member_id, role_id)
    )
  `);

  // Invites table
  await query(`
    CREATE TABLE IF NOT EXISTS invites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code VARCHAR(20) UNIQUE NOT NULL,
      server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
      channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      max_uses INTEGER,
      uses INTEGER DEFAULT 0,
      max_age INTEGER,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Direct message channels table
  await query(`
    CREATE TABLE IF NOT EXISTS dm_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(20) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // DM participants table
  await query(`
    CREATE TABLE IF NOT EXISTS dm_participants (
      channel_id UUID NOT NULL REFERENCES dm_channels(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (channel_id, user_id)
    )
  `);

  // Friends table
  await query(`
    CREATE TABLE IF NOT EXISTS friends (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, friend_id),
      CHECK (user_id != friend_id)
    )
  `);

  // User currency (RuCoin) table
  await query(`
    CREATE TABLE IF NOT EXISTS user_currency (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      rucoin_amount BIGINT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Shop items table
  await query(`
    CREATE TABLE IF NOT EXISTS shop_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL,
      price BIGINT NOT NULL,
      image_url TEXT,
      rarity VARCHAR(20) DEFAULT 'common',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // User purchases table
  await query(`
    CREATE TABLE IF NOT EXISTS user_purchases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
      purchased_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, item_id)
    )
  `);

  // User profile customization table
  await query(`
    CREATE TABLE IF NOT EXISTS user_profile_customization (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      banner_url TEXT,
      bio TEXT,
      accent_color VARCHAR(7),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // User custom banners table
  await query(`
    CREATE TABLE IF NOT EXISTS user_custom_banners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Create indexes
  await query(`
    CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id);
    CREATE INDEX IF NOT EXISTS idx_channels_server_id ON channels(server_id);
    CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
    CREATE INDEX IF NOT EXISTS idx_members_server_id ON members(server_id);
    CREATE INDEX IF NOT EXISTS idx_invites_code ON invites(code);
    CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
    CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
    CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
    CREATE INDEX IF NOT EXISTS idx_shop_items_type ON shop_items(type);
    CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(is_active);
    CREATE INDEX IF NOT EXISTS idx_user_purchases_user_id ON user_purchases(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_purchases_item_id ON user_purchases(item_id);
  `);

  // Migrate: Remove foreign key constraint from messages.channel_id if it exists
  // This allows channel_id to reference both channels and dm_channels tables
  try {
    await query(`
      ALTER TABLE messages 
      DROP CONSTRAINT IF EXISTS messages_channel_id_fkey
    `);
    console.log("Migration: Removed foreign key constraint from messages.channel_id");
  } catch (error) {
    // Ignore error if constraint doesn't exist
    console.log("Migration: Foreign key constraint already removed or doesn't exist");
  }

  // Initialize currency for existing users
  try {
    await query(`
      INSERT INTO user_currency (user_id, rucoin_amount)
      SELECT id, 1000
      FROM users
      WHERE id NOT IN (SELECT user_id FROM user_currency)
    `);
    console.log("Migration: Initialized currency for existing users");
  } catch (error) {
    console.log("Migration: Currency initialization skipped or already done");
  }

  console.log("Database tables created");
};

