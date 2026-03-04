"use client";

import { Hash, MessageSquare, Plus, Radio, Video } from "lucide-react";
import { type ComponentType, type FormEvent, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { type BrowseTab, ROOM_KINDS, type Room, type RoomKind, type StreamSession } from "../types";

type TabIconProps = { size?: number; className?: string };

const BROWSE_TABS: { id: BrowseTab; label: string; icon: ComponentType<TabIconProps> }[] = [
  { id: "all", label: "All", icon: Hash },
  { id: "live", label: "Live", icon: Radio },
  { id: "video", label: "Video", icon: Video },
  { id: "text", label: "Text", icon: MessageSquare },
];

type RoomSidebarProps = {
  activeRoomId: string;
  liveStreams: StreamSession[];
  onCreateRoom: (event: FormEvent<HTMLFormElement>) => void;
  onRoomKindDraftChange: (value: RoomKind) => void;
  onRoomNameDraftChange: (value: string) => void;
  onSelectRoom: (roomId: string) => void;
  onTabChange: (tab: BrowseTab) => void;
  roomKindDraft: RoomKind;
  roomNameById: Map<string, string>;
  roomNameDraft: string;
  rooms: Room[];
  tab: BrowseTab;
};

export function RoomSidebar({
  activeRoomId,
  liveStreams,
  onCreateRoom,
  onRoomKindDraftChange,
  onRoomNameDraftChange,
  onSelectRoom,
  onTabChange,
  roomKindDraft,
  roomNameById,
  roomNameDraft,
  rooms,
  tab,
}: RoomSidebarProps) {
  const [createOpen, setCreateOpen] = useState(false);

  const liveRoomIds = new Set(liveStreams.map((s) => s.room_id));

  const visibleRooms = rooms.filter((room) => {
    if (tab === "all") return true;
    if (tab === "live") return room.kind === "stream" && liveRoomIds.has(room.id);
    if (tab === "video") return room.kind === "video";
    if (tab === "text") return room.kind === "text" || room.kind === "voice";
    return true;
  });

  const visibleStreams = tab === "all" || tab === "live" ? liveStreams : [];

  return (
    <aside className="left-panel flex flex-col pt-0">
      {/* Browse tabs */}
      <div className="pb-1.5 shrink-0">
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as BrowseTab)}>
          <TabsList className="grid w-full grid-cols-4 bg-black/30 p-0.5 h-8">
            {BROWSE_TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                aria-label={label}
                className="py-1 px-0 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-[10px] flex items-center gap-1"
              >
                <Icon size={11} />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1">
        <div className="flex flex-col gap-3 py-1">
          {/* Live streams */}
          {visibleStreams.length > 0 && (
            <div className="space-y-1">
              <h3 className="section-label px-1">Live now</h3>
              <div className="grid gap-1">
                {visibleStreams.map((stream) => (
                  <button
                    key={stream.id}
                    className="flex flex-col gap-0.5 w-full text-left p-2 rounded-lg border border-white/[0.05] bg-white/[0.03] hover:bg-white/[0.06] hover:border-primary/30 transition-all group"
                    onClick={() => onSelectRoom(stream.room_id)}
                    type="button"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                      <strong className="text-[11px] font-medium truncate group-hover:text-primary transition-colors">
                        {stream.title}
                      </strong>
                    </div>
                    <span className="text-[9px] text-muted-foreground/60 pl-3">
                      {roomNameById.get(stream.room_id) ?? stream.room_id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Room list */}
          <div className="space-y-1">
            <h3 className="section-label px-1">
              {tab === "live"
                ? "Stream rooms"
                : tab === "video"
                  ? "Video rooms"
                  : tab === "text"
                    ? "Text rooms"
                    : "Rooms"}
            </h3>
            {visibleRooms.length > 0 ? (
              <div className="grid gap-0.5">
                {visibleRooms.map((room) => (
                  <button
                    key={room.id}
                    className={cn(
                      "flex items-center justify-between w-full px-2 py-1.5 rounded-md border border-transparent text-xs transition-all text-left",
                      room.id === activeRoomId
                        ? "bg-primary/10 border-primary/20 text-primary font-medium"
                        : "hover:bg-white/[0.04] text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onSelectRoom(room.id)}
                    type="button"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {room.kind === "text" && (
                        <MessageSquare size={12} className="opacity-40 shrink-0" />
                      )}
                      {room.kind === "video" && <Video size={12} className="opacity-40 shrink-0" />}
                      {room.kind === "stream" && (
                        <Radio size={12} className="opacity-40 shrink-0" />
                      )}
                      {room.kind === "voice" && <Hash size={12} className="opacity-40 shrink-0" />}
                      <span className="truncate">{room.name}</span>
                    </div>
                    {liveRoomIds.has(room.id) && (
                      <Badge
                        variant="outline"
                        className="h-3.5 px-1 text-[8px] border-red-500/40 text-red-400 bg-red-500/10 shrink-0"
                      >
                        LIVE
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground/50 px-1">No rooms here yet.</p>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Create room */}
      <div className="pt-1.5 border-t border-white/[0.05]">
        {!createOpen ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label="New room"
            className="w-full h-7 justify-start gap-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/[0.04] border border-dashed border-white/[0.07] hover:border-white/10"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={12} />
            New room
          </Button>
        ) : (
          <form
            className="grid gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.07]"
            onSubmit={(e) => {
              onCreateRoom(e);
              setCreateOpen(false);
            }}
          >
            <div className="grid gap-1">
              <label htmlFor="room-name-input" className="section-label">
                Name
              </label>
              <Input
                id="room-name-input"
                autoFocus
                className="h-7 text-xs bg-black/30 border-white/[0.08] focus-visible:ring-primary/40"
                onChange={(e) => onRoomNameDraftChange(e.target.value)}
                placeholder="Room name"
                value={roomNameDraft}
              />
            </div>
            <div className="grid gap-1">
              <label htmlFor="room-kind-select" className="section-label">
                Type
              </label>
              <Select
                onValueChange={(v) => onRoomKindDraftChange(v as RoomKind)}
                value={roomKindDraft}
              >
                <SelectTrigger
                  id="room-kind-select"
                  className="h-7 text-xs bg-black/30 border-white/[0.08] focus-visible:ring-primary/40"
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-white/[0.08]">
                  {ROOM_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind} className="text-xs">
                      {kind.charAt(0).toUpperCase() + kind.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-7 text-[10px]"
                onClick={() => setCreateOpen(false)}
                type="button"
              >
                Cancel
              </Button>
              <Button size="sm" className="flex-1 h-7 text-[10px] font-semibold" type="submit">
                Create
              </Button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
