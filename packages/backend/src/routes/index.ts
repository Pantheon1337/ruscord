import { Express } from "express";
import { authRoutes } from "./auth";
import { serverRoutes } from "./servers";
import { channelRoutes } from "./channels";
import { messageRoutes } from "./messages";
import { userRoutes } from "./users";
import { inviteRoutes } from "./invites";
import { dmRoutes } from "./dms";
import { friendRoutes } from "./friends";
import { shopRoutes } from "./shop";
import { profileRoutes } from "./profile";

export const setupRoutes = (app: Express) => {
  app.use("/api/auth", authRoutes);
  app.use("/api/servers", serverRoutes);
  app.use("/api/channels", channelRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/invites", inviteRoutes);
  app.use("/api/dms", dmRoutes);
  app.use("/api/friends", friendRoutes);
  app.use("/api/shop", shopRoutes);
  app.use("/api/profile", profileRoutes);
};

