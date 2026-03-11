'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { motion, AnimatePresence } from 'framer-motion'; // Added AnimatePresence
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import { ErrorMessage } from '@/components/embed-popup/error-message';
import { PopupView } from '@/components/embed-popup/popup-view';
import { Trigger } from '@/components/embed-popup/trigger';
import useConnectionDetails from '@/hooks/use-connection-details';
import { type AppConfig, EmbedErrorDetails } from '@/lib/types';
import { ExternalLink, X } from 'lucide-react'; // Assuming you use lucide for icons

const PopupViewMotion = motion.create(PopupView);

export type EmbedFixedAgentClientProps = {
  appConfig: AppConfig;
};

function AgentClient({ appConfig }: EmbedFixedAgentClientProps) {
  const isAnimating = useRef(false);
  const room = useMemo(() => new Room(), []);
  const [popupOpen, setPopupOpen] = useState(false);
  const [error, setError] = useState<EmbedErrorDetails | null>(null);
  
  // --- STATE FOR POPUP BLOCKER WORKAROUND ---
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  const { connectionDetails, refreshConnectionDetails, existingOrRefreshConnectionDetails } =
    useConnectionDetails(appConfig);

  // --- DATA LISTENER FOR TOOL CALLS ---
  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const strData = new TextDecoder().decode(payload);
        const data = JSON.parse(strData);

        // Matching the tool 'type' from our Python backend
        if (data.type === 'ACTION_OPEN_URL' && data.url) {
          console.log("AI suggested URL:", data.url);
          setPendingUrl(data.url); // Set the URL to show the UI button
        }
      } catch (e) {
        console.error("Failed to parse data message:", e);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  const handleTogglePopup = () => {
    if (isAnimating.current) return;
    setError(null);
    setPopupOpen((open) => !open);
    if (popupOpen) setPendingUrl(null); // Clear URL when closing
  };

  const handlePanelAnimationStart = () => { isAnimating.current = true; };
  const handlePanelAnimationComplete = () => {
    isAnimating.current = false;
    if (!popupOpen && room.state !== 'disconnected') {
      room.disconnect();
    }
  };

  // Connection logic (standard LiveKit setup)
  useEffect(() => {
    const onDisconnected = () => { setPopupOpen(false); refreshConnectionDetails(); };
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => { room.off(RoomEvent.Disconnected, onDisconnected); };
  }, [room, refreshConnectionDetails]);

  useEffect(() => {
    if (!popupOpen || !connectionDetails || room.state !== 'disconnected') return;
    const connect = async () => {
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
        const details = await existingOrRefreshConnectionDetails();
        await room.connect(details.serverUrl, details.participantToken);
      } catch (e: any) {
        setError({ title: 'Connection Error', description: e.message });
      }
    };
    connect();
  }, [room, popupOpen, connectionDetails, existingOrRefreshConnectionDetails]);

  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer />
      <StartAudio label="Start Audio" />

      <Trigger error={error} popupOpen={popupOpen} onToggle={handleTogglePopup} />

      <motion.div
        inert={!popupOpen}
        initial={{ opacity: 0, translateY: 8 }}
        animate={{ opacity: popupOpen ? 1 : 0, translateY: popupOpen ? 0 : 8 }}
        className="fixed right-4 bottom-20 left-4 z-50 md:left-auto"
        onAnimationComplete={handlePanelAnimationComplete}
      >
        <div className="bg-bg1 dark:bg-bg2 border-separator1 dark:border-separator2 ml-auto h-[480px] w-full rounded-[28px] border border-solid drop-shadow-md md:w-[360px] overflow-hidden">
          <div className="relative h-full w-full">
            <ErrorMessage error={error} />
            {!error && (
              <PopupViewMotion
                appConfig={appConfig}
                initial={{ opacity: 1 }}
                animate={{ opacity: error === null ? 1 : 0 }}
                disabled={!popupOpen}
                sessionStarted={popupOpen}
                onEmbedError={setError}
                className="absolute inset-0"
              />
            )}

            {/* --- POPUP BLOCKER UI OVERLAY --- */}
            <AnimatePresence>
              {pendingUrl && (
                <motion.div 
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 50, opacity: 0 }}
                  className="absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-blue-500/30 z-[60]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-500">Suggested Link</span>
                    <button onClick={() => setPendingUrl(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      window.open(pendingUrl, '_blank');
                      setPendingUrl(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors font-medium"
                  >
                    <ExternalLink size={18} />
                    Open Resource
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </RoomContext.Provider>
  );
}

export default AgentClient;
