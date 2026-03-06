'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Room, RoomEvent, DataPacket_Kind } from 'livekit-client'; // Added DataPacket_Kind
import { motion } from 'framer-motion';
import { RoomAudioRenderer, RoomContext, StartAudio } from '@livekit/components-react';
import { ErrorMessage } from '@/components/embed-popup/error-message';
import { PopupView } from '@/components/embed-popup/popup-view';
import { Trigger } from '@/components/embed-popup/trigger';
import useConnectionDetails from '@/hooks/use-connection-details';
import { type AppConfig, EmbedErrorDetails } from '@/lib/types';

const PopupViewMotion = motion.create(PopupView);

export type EmbedFixedAgentClientProps = {
  appConfig: AppConfig;
};

function AgentClient({ appConfig }: EmbedFixedAgentClientProps) {
  const isAnimating = useRef(false);
  const room = useMemo(() => new Room(), []);
  const [popupOpen, setPopupOpen] = useState(false);
  const [error, setError] = useState<EmbedErrorDetails | null>(null);
  const { connectionDetails, refreshConnectionDetails, existingOrRefreshConnectionDetails } =
    useConnectionDetails(appConfig);

  // --- START OF ADDED CODE FOR BROWSER NAVIGATION ---
  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const decoder = new TextDecoder();
        const strData = decoder.decode(payload);
        const data = JSON.parse(strData);

        // This checks if the message is the navigation command from your Python tool
        if (data.action === 'open_browser' && data.url) {
          console.log("AI requested navigation to:", data.url);
          window.open(data.url, '_blank');
        }
      } catch (e) {
        console.error("Failed to parse data message from AI:", e);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);
  // --- END OF ADDED CODE ---

  const handleTogglePopup = () => {
    if (isAnimating.current) {
      return;
    }

    setError(null);
    setPopupOpen((open) => !open);
  };

  const handlePanelAnimationStart = () => {
    isAnimating.current = true;
  };

  const handlePanelAnimationComplete = () => {
    isAnimating.current = false;
    if (!popupOpen && room.state !== 'disconnected') {
      room.disconnect();
    }
  };

  useEffect(() => {
    const onDisconnected = () => {
      setPopupOpen(false);
      refreshConnectionDetails();
    };
    const onMediaDevicesError = (error: Error) => {
      setError({
        title: 'Encountered an error with your media devices',
        description: `${error.name}: ${error.message}`,
      });
    };
    room.on(RoomEvent.MediaDevicesError, onMediaDevicesError);
    room.on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room.off(RoomEvent.Disconnected, onDisconnected);
      room.off(RoomEvent.MediaDevicesError, onMediaDevicesError);
    };
  }, [room, refreshConnectionDetails]);

  useEffect(() => {
    if (!popupOpen) {
      return;
    }
    if (!connectionDetails) {
      setError({
        title: 'Error fetching connection details',
        description: 'Please try again later',
      });
      return;
    }
    if (room.state !== 'disconnected') {
      return;
    }

    const connect = async () => {
      Promise.all([
        room.localParticipant.setMicrophoneEnabled(true, undefined, {
          preConnectBuffer: appConfig.isPreConnectBufferEnabled,
        }),
        existingOrRefreshConnectionDetails().then((connectionDetails) =>
          room.connect(connectionDetails.serverUrl, connectionDetails.participantToken)
        ),
      ]).catch((error) => {
        if (error instanceof Error) {
          console.error('Error connecting to agent:', error);
          setError({
            title: 'There was an error connecting to the agent',
            description: `${error.name}: ${error.message}`,
          });
        }
      });
    };

    connect();
  }, [
    room,
    popupOpen,
    connectionDetails,
    existingOrRefreshConnectionDetails,
    appConfig.isPreConnectBufferEnabled,
  ]);

  return (
    <RoomContext.Provider value={room}>
      <RoomAudioRenderer />
      <StartAudio label="Start Audio" />

      <Trigger error={error} popupOpen={popupOpen} onToggle={handleTogglePopup} />

      <motion.div
        inert={!popupOpen}
        initial={{
          opacity: 0,
          translateY: 8,
        }}
        animate={{
          opacity: popupOpen ? 1 : 0,
          translateY: popupOpen ? 0 : 8,
        }}
        transition={{
          bounce: 0,
          duration: popupOpen ? 1 : 0.2,
        } as any}
        onAnimationStart={handlePanelAnimationStart}
        onAnimationComplete={handlePanelAnimationComplete}
        className="fixed right-4 bottom-20 left-4 z-50 md:left-auto"
      >
        <div className="bg-bg1 dark:bg-bg2 border-separator1 dark:border-separator2 ml-auto h-[480px] w-full rounded-[28px] border border-solid drop-shadow-md md:w-[360px]">
          <div className="relative h-full w-full">
            <ErrorMessage error={error} />
            {!error && (
              <PopupViewMotion
                appConfig={appConfig}
                initial={{ opacity: 1 }}
                animate={{ opacity: error === null ? 1 : 0 }}
                transition={{
                  duration: 0.2,
                } as any}
                disabled={!popupOpen}
                sessionStarted={popupOpen}
                onEmbedError={setError}
                className="absolute inset-0"
              />
            )}
          </div>
        </div>
      </motion.div>
    </RoomContext.Provider>
  );
}

export default AgentClient;
