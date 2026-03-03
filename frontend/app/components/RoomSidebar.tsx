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
      <div className="pb-2 shrink-0">
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as BrowseTab)}>
          <TabsList className="grid w-full grid-cols-4 bg-black/40 p-1 h-9">
            {BROWSE_TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                aria-label={label}
                className="py-1 px-0 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs flex items-center gap-1"
              >
                <Icon size={13} />
                <span>{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="flex flex-col gap-4 py-2">
          {/* Live streams */}
          {visibleStreams.length > 0 && (
            <div className="space-y-2">
              <h3 className="section-label px-1">Live now</h3>
              <div className="grid gap-2">
                {visibleStreams.map((stream) => (
                  <button
                    key={stream.id}
                    className="flex flex-col gap-0.5 w-full text-left p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-primary/40 transition-all group"
                    onClick={() => onSelectRoom(stream.room_id)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <strong className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                        {stream.title}
                      </strong>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {roomNameById.get(stream.room_id) ?? stream.room_id}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Room list */}
          <div className="space-y-2">
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
                      "flex items-center justify-between w-full p-2 rounded-lg border border-transparent text-sm transition-all text-left",
                      room.id === activeRoomId
                        ? "bg-primary/15 border-primary/30 text-primary font-medium shadow-[0_0_15px_rgba(245,122,77,0.1)]"
                        : "hover:bg-white/5 text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => onSelectRoom(room.id)}
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      {room.kind === "text" && <MessageSquare size={14} className="opacity-50" />}
                      {room.kind === "video" && <Video size={14} className="opacity-50" />}
                      {room.kind === "stream" && <Radio size={14} className="opacity-50" />}
                      {room.kind === "voice" && <Hash size={14} className="opacity-50" />}
                      <span>{room.name}</span>
                    </div>
                    {liveRoomIds.has(room.id) && (
                      <Badge
                        variant="outline"
                        className="h-4 px-1.5 text-[10px] border-red-500/50 text-red-500 bg-red-500/10"
                      >
                        LIVE
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground px-1">No rooms here yet.</p>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Create room */}
      <div className="pt-2 border-t border-white/5">
        {!createOpen ? (
          <Button
            variant="outline"
            aria-label="+ New room"
            className="w-full justify-start gap-2 border-dashed border-white/10 bg-transparent text-muted-foreground hover:text-foreground hover:border-primary/50"
            onClick={() => setCreateOpen(true)}
          >
            <Plus size={16} />
            New room
          </Button>
        ) : (
          <form
            className="grid gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
            onSubmit={(e) => {
              onCreateRoom(e);
              setCreateOpen(false);
            }}
          >
            <div className="grid gap-1.5">
              <label
                htmlFor="room-name-input"
                className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"
              >
                Name
              </label>
              <Input
                id="room-name-input"
                autoFocus
                className="h-8 text-sm bg-black/40 border-white/10 focus-visible:ring-primary/50"
                onChange={(e) => onRoomNameDraftChange(e.target.value)}
                placeholder="Room name"
                value={roomNameDraft}
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="room-kind-select"
                className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"
              >
                Type
              </label>
              <Select
                onValueChange={(v) => onRoomKindDraftChange(v as RoomKind)}
                value={roomKindDraft}
              >
                <SelectTrigger
                  id="room-kind-select"
                  className="h-8 text-sm bg-black/40 border-white/10 focus-visible:ring-primary/50"
                >
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-card border-white/10">
                  {ROOM_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind} className="text-sm">
                      {kind.charAt(0).toUpperCase() + kind.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => setCreateOpen(false)}
                type="button"
              >
                Cancel
              </Button>
              <Button size="sm" className="flex-1 h-8 text-xs font-bold" type="submit">
                Create
              </Button>
            </div>
          </form>
        )}
      </div>
    </aside>
  );
}
