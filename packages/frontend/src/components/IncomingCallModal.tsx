import { useEffect, useState } from "react";
import { useCallStore } from "../store/callStore";
import { useAuthStore } from "../store/authStore";
import { wsManager } from "../services/websocket";
import api from "../api/client";
import "./IncomingCallModal.css";

export default function IncomingCallModal() {
  const { activeCall, acceptCall, rejectCall } = useCallStore();
  const { user } = useAuthStore();
  const [callerInfo, setCallerInfo] = useState<any>(null);

  useEffect(() => {
    if (!activeCall || activeCall.status !== "ringing" || !activeCall.isIncoming) {
      return;
    }

    // Load caller info
    const loadCallerInfo = async () => {
      try {
        const dmResponse = await api.get(`/dms`);
        const dmChannel = dmResponse.data.find((dm: any) => dm.id === activeCall.channelId);
        if (dmChannel && dmChannel.recipients && dmChannel.recipients.length > 0) {
          const caller = dmChannel.recipients.find((r: any) => r.id === activeCall.userId);
          if (caller) {
            setCallerInfo(caller);
          }
        }
      } catch (error) {
        // Silent error handling
      }
    };

    loadCallerInfo();
  }, [activeCall]);

  if (!activeCall || activeCall.status !== "ringing" || !activeCall.isIncoming) {
    return null;
  }

  const handleAccept = () => {
    acceptCall();
  };

  const handleReject = () => {
    // Send CALL_END to caller
    wsManager.send({
      op: 16, // CALL_END
      d: {
        userId: activeCall.userId,
        callId: activeCall.callId,
      },
    });
    rejectCall();
  };

  return (
    <div className="incoming-call-modal-overlay">
      <div className="incoming-call-modal">
        <div className="incoming-call-avatar">
          {callerInfo?.avatar ? (
            <img src={callerInfo.avatar} alt={callerInfo.username} />
          ) : (
            <div className="incoming-call-avatar-placeholder">
              {callerInfo?.username?.charAt(0).toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div className="incoming-call-info">
          <div className="incoming-call-name">
            {callerInfo?.username || "Неизвестный пользователь"}
          </div>
          <div className="incoming-call-type">
            Входящий звонок
          </div>
        </div>
        <div className="incoming-call-actions">
          <button
            className="incoming-call-btn reject"
            onClick={handleReject}
            title="Отклонить"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.69.28-.26 0-.51-.1-.69-.28L.28 13.1c-.18-.18-.28-.43-.28-.69 0-.26.1-.51.28-.69C3.34 8.78 7.46 7 12 7s8.66 1.78 11.72 4.72c.18.18.28.43.28.69 0 .26-.1.51-.28.69l-2.12 2.12c-.18.18-.43.28-.69.28-.26 0-.51-.1-.69-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
          <button
            className="incoming-call-btn accept"
            onClick={handleAccept}
            title="Принять"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

