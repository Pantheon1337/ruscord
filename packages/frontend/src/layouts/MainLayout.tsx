import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { useCallStore, useCallStore as useCallStoreDirect } from "../store/callStore";
import { wsManager } from "../services/websocket";
import ServerList from "../components/ServerList";
import ServerView from "../components/ServerView";
import WelcomeScreen from "../components/WelcomeScreen";
import UserProfile from "../components/UserProfile";
import CallView from "../components/CallView";
import IncomingCallModal from "../components/IncomingCallModal";
import "./MainLayout.css";

export default function MainLayout() {
  const { token, user } = useAuthStore();
  const { activeCall, setActiveCall } = useCallStore();

  useEffect(() => {
    if (token) {
      wsManager.connect();
    } else {
      wsManager.disconnect();
    }

    return () => {
      // Don't disconnect on unmount, as other components might still need it
    };
  }, [token]);

  // Global handler for incoming calls
  useEffect(() => {
    if (!token) return;

    const handleMessage = (message: any) => {
      if (message.op === 0 && message.t === "CALL_START") {
        // Only set active call if not already in a call
        const currentCall = useCallStoreDirect.getState().activeCall;
        if (!currentCall && message.d.channelId && message.d.from) {
          const callId = message.d.callId || `${message.d.from}-${user?.id}-${Date.now()}`;
          setActiveCall({
            callId,
            userId: message.d.from,
            channelId: message.d.channelId,
            type: message.d.type,
            isIncoming: true,
            status: "ringing",
          });
        }
      } else if (message.op === 0 && message.t === "CALL_OFFER") {
        // Store pending offer for incoming calls
        const callId = message.d.callId;
        const currentCall = useCallStoreDirect.getState().activeCall;
        if (currentCall && currentCall.callId === callId && currentCall.isIncoming) {
          useCallStoreDirect.getState().addPendingOffer(
            callId,
            message.d.offer,
            message.d.userId
          );
        }
      }
    };

    const unsubscribe = wsManager.subscribe(handleMessage);
    return unsubscribe;
  }, [token, user, setActiveCall]);

  return (
    <div className="main-layout">
      <ServerList />
      <Routes>
        <Route path="/servers/:serverId/:channelId?" element={<ServerView />} />
        <Route path="/channels/@me/:channelId?" element={<ServerView />} />
        <Route path="/channels/@me" element={<ServerView />} />
        <Route path="/home/:channelId?" element={<ServerView />} />
        <Route path="/" element={<ServerView />} />
        <Route path="*" element={<WelcomeScreen />} />
      </Routes>
      <UserProfile />
      
      <IncomingCallModal />
      
      {activeCall && (activeCall.status === "active" || (!activeCall.isIncoming && activeCall.status !== "ringing")) && (
        <CallView
          callId={activeCall.callId}
          userId={activeCall.userId}
          type={activeCall.type}
          isIncoming={activeCall.isIncoming}
          onEnd={() => setActiveCall(null)}
        />
      )}
      
      {/* Minimized call view is rendered inside CallView component */}
    </div>
  );
}

