"use client";

import { Hash, MessageSquare, Radio, Video as VideoIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { AuthModal } from "./components/AuthModal";
import { ChatPanel } from "./components/ChatPanel";
import { RightNav } from "./components/RightNav";
import { RoomSidebar } from "./components/RoomSidebar";
import { StreamExperience } from "./components/StreamExperience";
import { TopNav } from "./components/TopNav";
import { VideoExperience } from "./components/VideoExperience";
import { useBackendUrls } from "./hooks/useBackendUrls";
import { usePersistentUser } from "./hooks/usePersistentUser";
import { useRoomChat } from "./hooks/useRoomChat";
import { useRoomDirectory } from "./hooks/useRoomDirectory";
import { useRoomRealtime } from "./hooks/useRoomRealtime";

import type { AuthUser, BrowseTab, Room, RoomKind } from "./types";

export default function Home() {
  const { user, hydrated, setUser, clearUser } = usePersistentUser();
  const isAuthenticated = user !== null;
  const userId = user?.id ?? "";
  const sessionToken = user?.token ?? "";

  const { HTTP_BASE, buildWsUrl } = useBackendUrls();

  const [roomNameDraft, setRoomNameDraft] = useState("");
  const [roomKindDraft, setRoomKindDraft] = useState<RoomKind>("stream");

  const [statusNote, setStatusNote] = useState("Ready");
  const [authOpen, setAuthOpen] = useState(false);
  const [tab, setTab] = useState<BrowseTab>("all");

  const openAuthModal = useCallback(() => {
    setAuthOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthOpen(false);
  }, []);

  const handleOpenProfile = useCallback(() => {
    setStatusNote("Profile panel is coming soon.");
  }, []);

  const handleOpenSettings = useCallback(() => {
    setStatusNote("Settings panel is coming soon.");
  }, []);

  const {
    activeRoom,
    activeRoomId,
    fetchStreams,
    health,
    liveStreamForActiveRoom,
    liveStreams,
    roomNameById,
    rooms,
    setActiveRoomId,
    setRooms,
  } = useRoomDirectory({ httpBase: HTTP_BASE });

  const handleChatSessionInvalid = useCallback(() => {
    clearUser();
    setStatusNote("Session expired. Sign in again.");
    setAuthOpen(true);
  }, [clearUser]);

  const {
    chatSocketState,
    draft,
    messages,
    presenceUsers,
    reactionsById,
    setDraft,
    submitMessage,
    toggleReaction,
    typingUsers,
  } = useRoomChat({
    activeRoomId,
    buildWsUrl,
    hydrated,
    httpBase: HTTP_BASE,
    isAuthenticated,
    onAuthRequired: openAuthModal,
    onSessionInvalid: handleChatSessionInvalid,
    onStatusNote: setStatusNote,
    sessionToken,
    userId,
  });
  const {
    getRemoteVideoStream,
    handleFindStream,
    handleJoinVideoRoom,
    handleStartBroadcast,
    handleStopBroadcast,
    knownStreamHostId,
    leaveVideoRoom,
    resetRoomRealtimeState,
    signalSocketState,
    streamMode,
    streamObsConfig,
    streamObsIngestPreview,
    streamObsKeyDraft,
    streamObsServerDraft,
    streamPlaybackUrl,
    streamRemoteVideoRef,
    streamTitleDraft,
    streamViewerCount,
    setStreamObsKeyDraft,
    setStreamObsServerDraft,
    setStreamTitleDraft,
    videoJoined,
    videoLocalVideoRef,
    videoParticipantCount,
    videoRemoteUserIds,
  } = useRoomRealtime({
    activeRoom,
    activeRoomId,
    buildWsUrl,
    fetchStreams,
    hydrated,
    httpBase: HTTP_BASE,
    isAuthenticated,
    liveStreams,
    onAuthRequired: openAuthModal,
    onStatusNote: setStatusNote,
    sessionToken,
    userId,
  });

  const handleSelectRoom = useCallback(
    (nextRoomId: string): void => {
      if (nextRoomId === activeRoomId) {
        return;
      }

      resetRoomRealtimeState();
      setActiveRoomId(nextRoomId);
    },
    [activeRoomId, resetRoomRealtimeState, setActiveRoomId],
  );

  const submitCreateRoom = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<boolean> => {
      event.preventDefault();

      const name = roomNameDraft.trim();
      if (!name) {
        return false;
      }

      try {
        const response = await fetch(`${HTTP_BASE}/api/rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, kind: roomKindDraft }),
        });

        if (!response.ok) {
          setStatusNote("Could not create room.");
          return false;
        }

        const room = (await response.json()) as Room;
        setRooms((prev) => [...prev, room]);
        handleSelectRoom(room.id);
        setRoomNameDraft("");
        setStatusNote(`Created ${room.kind} room "${room.name}".`);
        return true;
      } catch {
        setStatusNote("Could not create room.");
        return false;
      }
    },
    [HTTP_BASE, handleSelectRoom, roomKindDraft, roomNameDraft, setRooms],
  );

  const handleLogout = useCallback((): void => {
    resetRoomRealtimeState();
    clearUser();
    setDraft("");
    setStatusNote("Signed out.");
  }, [clearUser, resetRoomRealtimeState, setDraft]);

  const handleAuthSuccess = useCallback(
    (nextUser: AuthUser) => {
      setUser(nextUser);
      setStatusNote(`Logged in as ${nextUser.username}`);
    },
    [setUser],
  );

  return (
    <div className="app-shell antialiased text-foreground">
      <TopNav
        user={user}
        onOpenAuth={openAuthModal}
        onOpenProfile={handleOpenProfile}
        onOpenSettings={handleOpenSettings}
        onLogout={handleLogout}
      />

      <RoomSidebar
        activeRoomId={activeRoomId}
        liveStreams={liveStreams}
        onCreateRoom={submitCreateRoom}
        onRoomKindDraftChange={setRoomKindDraft}
        onRoomNameDraftChange={setRoomNameDraft}
        onSelectRoom={handleSelectRoom}
        onTabChange={setTab}
        roomKindDraft={roomKindDraft}
        roomNameById={roomNameById}
        roomNameDraft={roomNameDraft}
        rooms={rooms}
        tab={tab}
      />

      <section className="main-panel animate-in" style={{ animationDelay: "150ms" }}>
        <header className="flex items-center gap-2 pb-2 border-b border-border/40 shrink-0">
          <h2 className="text-sm font-bold tracking-tight">
            {activeRoom ? activeRoom.name : "Pick a room"}
          </h2>
          {activeRoom && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 bg-primary/10 border-primary/20 text-primary text-[9px] font-extrabold uppercase tracking-widest"
            >
              {activeRoom.kind === "text" && <MessageSquare size={10} className="mr-1" />}
              {activeRoom.kind === "video" && <VideoIcon size={10} className="mr-1" />}
              {activeRoom.kind === "stream" && <Radio size={10} className="mr-1" />}
              {activeRoom.kind === "voice" && <Hash size={10} className="mr-1" />}
              {activeRoom.kind}
            </Badge>
          )}
        </header>

        {activeRoom?.kind === "stream" ? (
          <div className="shrink-0">
            <StreamExperience
              knownStreamHostId={knownStreamHostId}
              liveStreamTitle={liveStreamForActiveRoom?.title ?? null}
              obsConfig={streamObsConfig}
              obsIngestPreview={streamObsIngestPreview}
              obsServerDraft={streamObsServerDraft}
              obsStreamKeyDraft={streamObsKeyDraft}
              onFindStream={handleFindStream}
              onObsServerDraftChange={setStreamObsServerDraft}
              onObsStreamKeyDraftChange={setStreamObsKeyDraft}
              onStartBroadcast={handleStartBroadcast}
              onStopBroadcast={handleStopBroadcast}
              onStreamTitleDraftChange={setStreamTitleDraft}
              streamMode={streamMode}
              streamPlaybackUrl={streamPlaybackUrl}
              streamPlaybackVideoRef={streamRemoteVideoRef}
              streamTitleDraft={streamTitleDraft}
              streamViewerCount={streamViewerCount}
            />
          </div>
        ) : null}

        {activeRoom?.kind === "video" ? (
          <div className="shrink-0">
            <VideoExperience
              getRemoteVideoStream={getRemoteVideoStream}
              onJoinVideoRoom={handleJoinVideoRoom}
              onLeaveVideoRoom={leaveVideoRoom}
              videoJoined={videoJoined}
              videoLocalVideoRef={videoLocalVideoRef}
              videoParticipantCount={videoParticipantCount}
              videoRemoteUserIds={videoRemoteUserIds}
            />
          </div>
        ) : null}

        <ChatPanel
          canChat={isAuthenticated}
          currentUserId={user?.id ?? null}
          currentUsername={user?.username ?? null}
          draft={draft}
          messages={messages}
          presenceUsers={presenceUsers}
          reactionsById={reactionsById}
          typingUsers={typingUsers}
          onOpenAuth={openAuthModal}
          onDraftChange={setDraft}
          onSubmit={submitMessage}
          onToggleReaction={toggleReaction}
        />
      </section>

      <RightNav
        backendHealthy={health?.ok ?? false}
        chatSocketState={chatSocketState}
        signalSocketState={signalSocketState}
        statusNote={statusNote}
        user={user}
        onOpenAuth={openAuthModal}
        onLogout={handleLogout}
      />

      {authOpen && <AuthModal onClose={closeAuthModal} onSuccess={handleAuthSuccess} />}
    </div>
  );
}
