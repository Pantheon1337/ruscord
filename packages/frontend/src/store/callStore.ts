import { create } from "zustand";

interface ActiveCall {
  callId: string;
  userId: string;
  channelId: string;
  type: "voice" | "video";
  isIncoming: boolean;
  status: "ringing" | "active" | "ended";
  startTime?: number;
}

interface PendingOffer {
  callId: string;
  offer: RTCSessionDescriptionInit;
  userId: string;
}

interface CallState {
  activeCall: ActiveCall | null;
  pendingOffers: Map<string, PendingOffer>;
  isMinimized: boolean;
  setActiveCall: (call: ActiveCall | null) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  addPendingOffer: (callId: string, offer: RTCSessionDescriptionInit, userId: string) => void;
  getPendingOffer: (callId: string) => PendingOffer | undefined;
  removePendingOffer: (callId: string) => void;
  setMinimized: (minimized: boolean) => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  pendingOffers: new Map(),
  isMinimized: false,
  setActiveCall: (call) => {
    if (!call) {
      set({ activeCall: null, isMinimized: false });
      return;
    }
    // If call is incoming, set status to "ringing", otherwise "active"
    const status = call.isIncoming ? "ringing" : "active";
    const startTime = call.isIncoming ? undefined : Date.now();
    set({ 
      activeCall: { ...call, status, startTime },
      isMinimized: false
    });
  },
  acceptCall: () => set((state) => {
    if (state.activeCall) {
      return {
        activeCall: { ...state.activeCall, status: "active", startTime: Date.now() }
      };
    }
    return state;
  }),
  rejectCall: () => set({ activeCall: null }),
  addPendingOffer: (callId, offer, userId) => {
    const newMap = new Map(get().pendingOffers);
    newMap.set(callId, { callId, offer, userId });
    set({ pendingOffers: newMap });
  },
  getPendingOffer: (callId) => {
    return get().pendingOffers.get(callId);
  },
  removePendingOffer: (callId) => {
    const newMap = new Map(get().pendingOffers);
    newMap.delete(callId);
    set({ pendingOffers: newMap });
  },
  setMinimized: (minimized) => set({ isMinimized: minimized }),
}));

