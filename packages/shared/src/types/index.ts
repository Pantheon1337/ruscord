// User types
export interface User {
  id: string;
  username: string;
  discriminator: string;
  email: string;
  avatar?: string;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserStatus {
  ONLINE = "online",
  IDLE = "idle",
  DO_NOT_DISTURB = "dnd",
  OFFLINE = "offline",
}

// Server types
export interface Server {
  id: string;
  name: string;
  icon?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Channel types
export enum ChannelType {
  TEXT = "TEXT",
  VOICE = "VOICE",
  DM = "DM",
  GROUP_DM = "GROUP_DM",
}

export interface Channel {
  id: string;
  serverId?: string;
  name: string;
  type: ChannelType;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

// Message types
export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  attachments: Attachment[];
  embeds: Embed[];
  reactions: Reaction[];
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  image?: { url: string };
  thumbnail?: { url: string };
  fields?: EmbedField[];
  timestamp?: Date;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

// Role and Permission types
export interface Role {
  id: string;
  serverId: string;
  name: string;
  color: number;
  permissions: bigint;
  position: number;
  mentionable: boolean;
  hoist: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const Permission = {
  // General
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  
  // Text
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  USE_EXTERNAL_STICKERS: 1n << 19n,
  
  // Voice
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  
  // Advanced
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EMOJIS_AND_STICKERS: 1n << 30n,
  USE_APPLICATION_COMMANDS: 1n << 31n,
  REQUEST_TO_SPEAK: 1n << 32n,
  MANAGE_EVENTS: 1n << 33n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS_EXTENDED: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  USE_EMBEDDED_ACTIVITIES: 1n << 39n,
  MODERATE_MEMBERS: 1n << 40n,
} as const;

export type Permission = typeof Permission[keyof typeof Permission];

// Invite types
export interface Invite {
  id: string;
  code: string;
  serverId: string;
  channelId: string;
  inviterId: string;
  maxUses?: number;
  uses: number;
  maxAge?: number;
  expiresAt?: Date;
  createdAt: Date;
}

// Member types
export interface Member {
  id: string;
  userId: string;
  serverId: string;
  nickname?: string;
  roles: string[];
  joinedAt: Date;
}

// WebSocket event types
export interface WebSocketMessage {
  op: number;
  d?: any;
  t?: string;
}

export enum GatewayOpcode {
  DISPATCH = 0,
  HEARTBEAT = 1,
  IDENTIFY = 2,
  PRESENCE_UPDATE = 3,
  VOICE_STATE_UPDATE = 4,
  CALL_START = 15,
  CALL_END = 16,
  CALL_OFFER = 17,
  CALL_ANSWER = 18,
  CALL_ICE_CANDIDATE = 19,
  RESUME = 6,
  RECONNECT = 7,
  INVALID_SESSION = 9,
  HELLO = 10,
  HEARTBEAT_ACK = 11,
}

