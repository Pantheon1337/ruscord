-- Migration: Remove foreign key constraint from messages.channel_id
-- This allows channel_id to reference both channels and dm_channels tables

-- Drop the existing foreign key constraint
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_channel_id_fkey;

-- Note: The column itself remains unchanged, just the constraint is removed

