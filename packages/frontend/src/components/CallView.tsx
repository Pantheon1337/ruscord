import { useEffect, useRef, useState } from "react";
import { wsManager } from "../services/websocket";
import { useAuthStore } from "../store/authStore";
import { useCallStore } from "../store/callStore";
import api from "../api/client";
import "./CallView.css";

interface CallViewProps {
  callId: string;
  userId: string;
  type: "voice" | "video";
  isIncoming: boolean;
  onEnd: () => void;
}

export default function CallView({
  callId,
  userId,
  type,
  isIncoming,
  onEnd,
}: CallViewProps) {
  const { user } = useAuthStore();
  const { isMinimized, setMinimized } = useCallStore();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isRemoteVideoEnabled, setIsRemoteVideoEnabled] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteUser, setRemoteUser] = useState<{ username: string; avatar?: string } | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const audioSenderRef = useRef<RTCRtpSender | null>(null);
  const currentVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Subscribe to WebSocket messages FIRST, before initializing call
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.op === 0) {
        const isFromCaller = message.d.userId === userId;
        const messageCallId = message.d.callId;
        
        // Only process messages for this specific call
        if (messageCallId && messageCallId !== callId) {
          return;
        }
        
        if (message.t === "CALL_OFFER" && isFromCaller) {
          // Handle offer for incoming calls or renegotiation
          if (!peerConnectionRef.current || peerConnectionRef.current.signalingState === "closed") {
            const { addPendingOffer } = useCallStore.getState();
            addPendingOffer(callId, message.d.offer, message.d.userId);
          } else {
            handleOffer(message.d.offer);
          }
        } else if (message.t === "CALL_ANSWER" && isFromCaller) {
          // Handle answer for outgoing calls or renegotiation
          handleAnswer(message.d.answer);
        } else if (message.t === "CALL_ICE_CANDIDATE" && isFromCaller) {
          handleIceCandidate(message.d.candidate);
        } else if (message.t === "CALL_END" && isFromCaller) {
          handleEndCall();
        }
      }
    };

    const unsubscribe = wsManager.subscribe(handleMessage);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, isIncoming, userId]);

  // Load remote user info
  useEffect(() => {
    const loadRemoteUser = async () => {
      try {
        const response = await api.get(`/users/${userId}`);
        setRemoteUser({
          username: response.data.username,
          avatar: response.data.avatar,
        });
      } catch (error) {
        // Fallback to userId if user not found
        setRemoteUser({
          username: userId.substring(0, 8),
          avatar: undefined,
        });
      }
    };
    
    if (userId) {
      loadRemoteUser();
    }
  }, [userId]);

  useEffect(() => {
    let isMounted = true;
    
    initializeCall().catch(() => {
      if (isMounted) {
        onEnd();
      }
    });
    
    return () => {
      isMounted = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Call duration timer
  useEffect(() => {
    if (!isConnected) {
      setCallDuration(0);
      return;
    }

    const interval = setInterval(() => {
      const { activeCall } = useCallStore.getState();
      if (activeCall?.startTime) {
        const duration = Math.floor((Date.now() - activeCall.startTime) / 1000);
        setCallDuration(duration);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  // Update local video display when stream or video state changes
  useEffect(() => {
    if (!localVideoRef.current) return;
    
    if (isVideoEnabled && localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        localVideoRef.current.srcObject = localStreamRef.current;
      } else {
        localVideoRef.current.srcObject = null;
      }
    } else {
      localVideoRef.current.srcObject = null;
    }
  }, [isVideoEnabled, isScreenSharing]);

  // Update remote video display when stream changes
  useEffect(() => {
    if (!remoteVideoRef.current || !remoteStreamRef.current) return;
    
    const videoTracks = remoteStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0 && videoTracks[0].readyState === 'live') {
      // Force update by clearing and setting again
        remoteVideoRef.current.srcObject = null;
        setTimeout(() => {
          if (remoteVideoRef.current && remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
          remoteVideoRef.current.play().catch(() => {});
          }
        }, 0);
      if (!isRemoteVideoEnabled) {
        setIsRemoteVideoEnabled(true);
      }
    } else if (videoTracks.length === 0 && isRemoteVideoEnabled) {
      remoteVideoRef.current.srcObject = null;
      setIsRemoteVideoEnabled(false);
    }
  }, [remoteStreamRef.current?.id, isRemoteVideoEnabled]);

  const initializeCall = async () => {
    // Check if already initialized
    if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== "closed") {
      return;
    }
    
    try {
      // Create RTCPeerConnection
      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      };

      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          wsManager.send({
            op: 19, // CALL_ICE_CANDIDATE
            d: {
              userId,
              callId,
              candidate: event.candidate.toJSON(),
            },
          });
        }
      };

      // Handle remote stream
      pc.ontrack = (event) => {
        // Create or update remote stream
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        
        const track = event.track;
            
            // Remove old track of same kind if exists
        const oldTracks = remoteStreamRef.current.getTracks().filter(
              t => t.kind === track.kind
        );
            oldTracks.forEach(oldTrack => {
          oldTrack.stop();
              remoteStreamRef.current?.removeTrack(oldTrack);
            });
            
            // Add new track
        remoteStreamRef.current.addTrack(track);
            
            // Listen for track ending
            track.onended = () => {
              remoteStreamRef.current?.removeTrack(track);
              if (track.kind === 'video') {
                  setIsRemoteVideoEnabled(false);
                }
        };
        
        // Update displays
        if (track.kind === 'video' && remoteVideoRef.current) {
          // Update state first
          setIsRemoteVideoEnabled(true);
          
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            if (remoteVideoRef.current && remoteStreamRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              
              // Try to play video
              remoteVideoRef.current.play().catch(() => {
                // Try again after a short delay
                setTimeout(() => {
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play().catch(() => {});
                  }
                }, 100);
              });
            }
          });
        } else if (track.kind === 'audio' && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStreamRef.current;
        }
      };

      // Handle connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setIsConnected(true);
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setIsConnected(false);
        } else if (pc.connectionState === "closed") {
          setIsConnected(false);
        }
      };

      // Get user media - audio always, video only if enabled
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isVideoEnabled ? { width: 1280, height: 720 } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      // Check if connection is still valid before adding tracks
      if (pc.signalingState === "closed") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      // Add tracks to peer connection and save senders
      stream.getTracks().forEach((track) => {
        if (pc.signalingState !== "closed") {
          const sender = pc.addTrack(track, stream);
          if (track.kind === 'video') {
            videoSenderRef.current = sender;
            currentVideoTrackRef.current = track;
          } else if (track.kind === 'audio') {
            audioSenderRef.current = sender;
      }
        }
      });

      if (!isIncoming) {
        // Start outgoing call - create offer immediately
        await startCall(pc);
      } else {
        // Check if we have a pending offer in global store
        const { getPendingOffer, removePendingOffer } = useCallStore.getState();
        const pendingOffer = getPendingOffer(callId);
        if (pendingOffer) {
          removePendingOffer(callId);
          // Process offer immediately
          if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== "closed") {
            await handleOffer(pendingOffer.offer);
          }
        }
      }
    } catch (error) {
      onEnd();
    }
  };

  const startCall = async (pc: RTCPeerConnection) => {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      wsManager.send({
        op: 17, // CALL_OFFER
        d: {
          userId,
          callId,
          offer: offer,
        },
      });
    } catch (error) {
      // Silent error handling
    }
  };

  const answerCall = async (pc: RTCPeerConnection) => {
    try {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      wsManager.send({
        op: 18, // CALL_ANSWER
        d: {
          userId,
          callId,
          answer: answer,
        },
      });
    } catch (error) {
      // Silent error handling
    }
  };

  const cleanup = () => {
    // Stop all video tracks
    if (currentVideoTrackRef.current) {
      currentVideoTrackRef.current.stop();
      currentVideoTrackRef.current = null;
    }

    // Stop all local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Stop all remote stream tracks
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    // Clear sender references
    videoSenderRef.current = null;
    audioSenderRef.current = null;
  };

  const handleEndCall = () => {
    wsManager.send({
      op: 16, // CALL_END
      d: {
        userId,
        callId,
      },
    });
    cleanup();
    onEnd();
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const handleToggleVideo = async () => {
    if (!peerConnectionRef.current) return;

      try {
      if (!isVideoEnabled) {
        // Enable video
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });

        const videoTrack = videoStream.getVideoTracks()[0];
        
        // Stop old video track if exists
        if (currentVideoTrackRef.current) {
          currentVideoTrackRef.current.stop();
        }

        // Update local stream
        if (localStreamRef.current) {
          // Remove old video tracks
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.stop();
            localStreamRef.current?.removeTrack(track);
          });
          // Add new video track
          localStreamRef.current.addTrack(videoTrack);
        } else {
          // Create new stream with video and audio
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = new MediaStream([
            videoTrack,
            ...audioStream.getAudioTracks()
          ]);
        }

        currentVideoTrackRef.current = videoTrack;

        // Replace or add video track in peer connection
        if (videoSenderRef.current) {
          await videoSenderRef.current.replaceTrack(videoTrack);
        } else {
          const sender = peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);
          videoSenderRef.current = sender;
        }

        // Renegotiate - wait a bit for track to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
        
        if (peerConnectionRef.current.signalingState === "stable") {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          wsManager.send({
            op: 17,
            d: { userId, callId, offer },
          });
        }

        setIsVideoEnabled(true);
        setIsScreenSharing(false);
    } else {
        // Disable video
        if (currentVideoTrackRef.current) {
          currentVideoTrackRef.current.stop();
          currentVideoTrackRef.current = null;
        }

      if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
        }

        // Remove video track from peer connection
        if (videoSenderRef.current) {
          await videoSenderRef.current.replaceTrack(null);
        }

        // Renegotiate - wait a bit for track removal
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (peerConnectionRef.current.signalingState === "stable") {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          wsManager.send({
            op: 17,
            d: { userId, callId, offer },
          });
        }

        setIsVideoEnabled(false);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const handleToggleScreenShare = async () => {
    if (!peerConnectionRef.current) return;

    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: false,
        });

        const screenTrack = screenStream.getVideoTracks()[0];

        // Stop old video track if exists
        if (currentVideoTrackRef.current) {
          currentVideoTrackRef.current.stop();
        }

        // Update local stream - keep audio, replace video
        if (localStreamRef.current) {
          // Remove old video tracks
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.stop();
            localStreamRef.current?.removeTrack(track);
          });
          // Add screen track
          localStreamRef.current.addTrack(screenTrack);
        } else {
          // Create new stream with screen and audio
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          localStreamRef.current = new MediaStream([
            screenTrack,
            ...audioStream.getAudioTracks()
          ]);
        }

        currentVideoTrackRef.current = screenTrack;

        // Replace or add video track in peer connection
        if (videoSenderRef.current) {
          await videoSenderRef.current.replaceTrack(screenTrack);
        } else {
          const sender = peerConnectionRef.current.addTrack(screenTrack, localStreamRef.current);
          videoSenderRef.current = sender;
        }

        // Renegotiate - wait a bit for track to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
        
        if (peerConnectionRef.current.signalingState === "stable") {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          wsManager.send({
            op: 17,
            d: { userId, callId, offer },
          });
        }

        setIsScreenSharing(true);
        setIsVideoEnabled(true);

        // Stop screen sharing when user stops sharing
        screenTrack.onended = () => {
          handleToggleScreenShare();
        };
      } else {
        // Stop screen sharing
        if (currentVideoTrackRef.current) {
          currentVideoTrackRef.current.stop();
          currentVideoTrackRef.current = null;
        }

        // Remove video track from peer connection
        if (videoSenderRef.current) {
          await videoSenderRef.current.replaceTrack(null);
        }

        // Update local stream - remove video, keep audio
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.stop();
            localStreamRef.current?.removeTrack(track);
          });
        }

        // Renegotiate - wait a bit for track removal
          await new Promise(resolve => setTimeout(resolve, 100));
        
        if (peerConnectionRef.current.signalingState === "stable") {
          const offer = await peerConnectionRef.current.createOffer();
          await peerConnectionRef.current.setLocalDescription(offer);
          wsManager.send({
            op: 17,
            d: { userId, callId, offer },
          });
        }

        setIsScreenSharing(false);
        setIsVideoEnabled(false);
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const handleMinimize = () => {
    setMinimized(true);
  };


  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!peerConnectionRef.current) {
      const { addPendingOffer } = useCallStore.getState();
      addPendingOffer(callId, offer, userId);
      return;
    }
    
    if (peerConnectionRef.current.signalingState === "closed") {
      return;
    }
    
    try {
      // Check if this is a renegotiation
      const isRenegotiation = peerConnectionRef.current.signalingState === "stable" && 
                             peerConnectionRef.current.localDescription !== null;
      
      if (isRenegotiation) {
        // For renegotiation, we need to set remote description first
        // The signaling state should transition to "have-remote-offer"
        await peerConnectionRef.current.setRemoteDescription(offer);
      } else {
        // Initial offer
        await peerConnectionRef.current.setRemoteDescription(offer);
      }
      
      // Add any pending ICE candidates
      for (const candidate of pendingIceCandidatesRef.current) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (error) {
          // Silent error handling
        }
      }
      pendingIceCandidatesRef.current = [];
      
      await answerCall(peerConnectionRef.current);
    } catch (error) {
      // Silent error handling
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(answer);
        
        // Add any pending ICE candidates
        for (const candidate of pendingIceCandidatesRef.current) {
          try {
            await peerConnectionRef.current.addIceCandidate(
              new RTCIceCandidate(candidate)
            );
          } catch (error) {
            // Silent error handling
          }
        }
        pendingIceCandidatesRef.current = [];
      } catch (error) {
        // Silent error handling
      }
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!peerConnectionRef.current || !candidate) return;
    
    const pc = peerConnectionRef.current;
    
    // If remote description is not set yet, queue the candidate
    if (!pc.remoteDescription) {
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }
    
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      // Silent error handling - candidate might already be added
    }
  };

  if (isMinimized) {
    return (
      <div className="call-view-minimized" onClick={() => setMinimized(false)}>
        <div className="minimized-call-info">
          <div className="minimized-call-avatar">
            {user?.username?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="minimized-call-details">
            <div className="minimized-call-name">Звонок активен</div>
            <div className="minimized-call-duration">
              {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}
            </div>
          </div>
        </div>
        <button
          className="minimized-call-end-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleEndCall();
          }}
          title="Завершить звонок"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.69.28-.26 0-.51-.1-.69-.28L.28 13.1c-.18-.18-.28-.43-.28-.69 0-.26.1-.51.28-.69C3.34 8.78 7.46 7 12 7s8.66 1.78 11.72 4.72c.18.18.28.43.28.69 0 .26-.1.51-.28.69l-2.12 2.12c-.18.18-.43.28-.69.28-.26 0-.51-.1-.69-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="call-view">
      <div className="call-container">
        <div className="video-call">
          <div className="remote-video-container">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              style={{ display: isRemoteVideoEnabled ? 'block' : 'none' }}
              />
            {!isRemoteVideoEnabled && (
              <div className="remote-video-placeholder">
                <div className="user-avatar-large">
                  {remoteUser?.username?.charAt(0).toUpperCase() || "U"}
                </div>
                {!isVideoEnabled && (
                <div className="call-status">
                  {isConnected ? (
                    <div>
                      <div>Подключено</div>
                      <div className="call-duration">
                        {Math.floor(callDuration / 60)}:{(callDuration % 60).toString().padStart(2, "0")}
                      </div>
                    </div>
                  ) : (
                    "Подключение..."
                  )}
                </div>
                )}
              </div>
            )}
          </div>
          {isVideoEnabled && (
            <div className="local-video-container">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video"
              />
            </div>
          )}
        </div>

        <audio ref={remoteAudioRef} autoPlay />
        <audio ref={localAudioRef} autoPlay muted />

        <div className="call-controls">
          <button
            className="call-control-btn"
            onClick={handleMinimize}
            title="Свернуть"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13H5v-2h14v2z"/>
            </svg>
          </button>

          <button
            className={`call-control-btn ${isMuted ? "muted" : ""}`}
            onClick={handleToggleMute}
            title={isMuted ? "Включить микрофон" : "Выключить микрофон"}
          >
            {isMuted ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            )}
          </button>

          <button
            className={`call-control-btn ${!isVideoEnabled ? "disabled" : ""}`}
            onClick={handleToggleVideo}
            title={isVideoEnabled ? "Выключить камеру" : "Включить камеру"}
          >
            {isVideoEnabled ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21 6.5l-3.5-3.5L16 4.5 4.5 16 3 17.5 6.5 21 8 19.5 19.5 8 21 6.5zM17 10.5V7H4v10h13v-3.5l4 4v-11l-4 4z"/>
              </svg>
            )}
          </button>
          <button
            className={`call-control-btn ${isScreenSharing ? "active" : ""}`}
            onClick={handleToggleScreenShare}
            title={isScreenSharing ? "Остановить демонстрацию экрана" : "Демонстрация экрана"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
            </svg>
          </button>

          <button
            className="call-control-btn end-call"
            onClick={handleEndCall}
            title="Завершить звонок"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.69.28-.26 0-.51-.1-.69-.28L.28 13.1c-.18-.18-.28-.43-.28-.69 0-.26.1-.51.28-.69C3.34 8.78 7.46 7 12 7s8.66 1.78 11.72 4.72c.18.18.28.43.28.69 0 .26-.1.51-.28.69l-2.12 2.12c-.18.18-.43.28-.69.28-.26 0-.51-.1-.69-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

