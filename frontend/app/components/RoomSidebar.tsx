"use client";

import { Hash, MessageSquare, Plus, Radio, Video } from "lucide-react";
import {
	type ComponentType,
	type FormEvent,
	memo,
	useMemo,
	useState,
} from "react";

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

import {
	type BrowseTab,
	ROOM_KINDS,
	type Room,
	type RoomKind,
	type StreamSession,
} from "../types";

type TabIconProps = { size?: number; className?: string };

const BROWSE_TABS: {
	id: BrowseTab;
	label: string;
	icon: ComponentType<TabIconProps>;
}[] = [
	{ id: "all", label: "All", icon: Hash },
	{ id: "live", label: "Live", icon: Radio },
	{ id: "video", label: "Video", icon: Video },
	{ id: "text", label: "Text", icon: MessageSquare },
];

type RoomSidebarProps = {
	activeRoomId: string;
	liveStreams: StreamSession[];
	onCreateRoom: (
		event: FormEvent<HTMLFormElement>,
	) => Promise<boolean> | boolean;
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

export const RoomSidebar = memo(function RoomSidebar({
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

	const liveRoomIds = useMemo(
		() => new Set(liveStreams.map((stream) => stream.room_id)),
		[liveStreams],
	);

	const visibleRooms = useMemo(
		() =>
			rooms.filter((room) => {
				if (tab === "all") return true;
				if (tab === "live")
					return room.kind === "stream" && liveRoomIds.has(room.id);
				if (tab === "video") return room.kind === "video";
				if (tab === "text")
					return room.kind === "text" || room.kind === "voice";
				return true;
			}),
		[liveRoomIds, rooms, tab],
	);

	const visibleStreams = useMemo(
		() => (tab === "all" || tab === "live" ? liveStreams : []),
		[liveStreams, tab],
	);

	return (
		<aside className="left-panel animate-in" style={{ animationDelay: "50ms" }}>
			{/* Browse tabs */}
			<div className="pb-1.5 shrink-0">
				<Tabs value={tab} onValueChange={(v) => onTabChange(v as BrowseTab)}>
					<TabsList className="grid w-full grid-cols-4 bg-muted/40 p-0.5 h-8 border border-border/40 rounded-xl">
						{BROWSE_TABS.map(({ id, label, icon: Icon }) => (
							<TabsTrigger
								key={id}
								value={id}
								aria-label={label}
								className="py-1 px-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all text-[10px] flex items-center gap-1 rounded-lg"
							>
								<Icon size={11} />
								<span className="font-bold uppercase tracking-wider">
									{label}
								</span>
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>
			</div>

			<ScrollArea className="flex-1 -mx-2 px-2">
				<div className="flex flex-col gap-4 py-1">
					{/* Live streams */}
					{visibleStreams.length > 0 && (
						<div className="space-y-1.5">
							<h3 className="section-label">Live now</h3>
							<div className="grid gap-1">
								{visibleStreams.map((stream) => (
									<button
										key={stream.id}
										className="flex flex-col gap-0.5 w-full text-left p-2.5 rounded-xl border border-border/40 bg-card/40 hover:bg-primary/5 hover:border-primary/30 transition-all group"
										onClick={() => onSelectRoom(stream.room_id)}
										type="button"
									>
										<div className="flex items-center gap-1.5">
											<div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
											<strong className="text-[12px] font-bold truncate group-hover:text-primary transition-colors">
												{stream.title}
											</strong>
										</div>
										<span className="text-[10px] text-muted-foreground/60 pl-3 font-medium">
											{roomNameById.get(stream.room_id) ?? stream.room_id}
										</span>
									</button>
								))}
							</div>
						</div>
					)}

					{/* Room list */}
					<div className="space-y-1.5">
						<h3 className="section-label">
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
											"flex items-center justify-between w-full px-2.5 py-2 rounded-xl border border-transparent text-sm transition-all text-left group",
											room.id === activeRoomId
												? "bg-primary/15 border-primary/20 text-primary font-bold shadow-sm"
												: "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
										)}
										onClick={() => onSelectRoom(room.id)}
										type="button"
									>
										<div className="flex items-center gap-2 min-w-0">
											{room.kind === "text" && (
												<MessageSquare
													size={14}
													className={cn(
														"shrink-0",
														room.id === activeRoomId
															? "text-primary"
															: "opacity-40 group-hover:opacity-100",
													)}
												/>
											)}
											{room.kind === "video" && (
												<Video
													size={14}
													className={cn(
														"shrink-0",
														room.id === activeRoomId
															? "text-primary"
															: "opacity-40 group-hover:opacity-100",
													)}
												/>
											)}
											{room.kind === "stream" && (
												<Radio
													size={14}
													className={cn(
														"shrink-0",
														room.id === activeRoomId
															? "text-primary"
															: "opacity-40 group-hover:opacity-100",
													)}
												/>
											)}
											{room.kind === "voice" && (
												<Hash
													size={14}
													className={cn(
														"shrink-0",
														room.id === activeRoomId
															? "text-primary"
															: "opacity-40 group-hover:opacity-100",
													)}
												/>
											)}
											<span className="truncate font-semibold text-[13px]">
												{room.name}
											</span>
										</div>
										{liveRoomIds.has(room.id) && (
											<Badge
												variant="outline"
												className="h-4 px-1 text-[8px] border-red-500/40 text-red-500 bg-red-500/10 shrink-0 font-bold"
											>
												LIVE
											</Badge>
										)}
									</button>
								))}
							</div>
						) : (
							<p className="text-[11px] text-muted-foreground/50 px-1 font-medium italic">
								No rooms here yet.
							</p>
						)}
					</div>
				</div>
			</ScrollArea>

			{/* Create room */}
			<div className="pt-2 border-t border-border/40">
				{!createOpen ? (
					<Button
						variant="ghost"
						size="sm"
						aria-label="New room"
						className="w-full h-8 justify-start gap-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-primary hover:bg-primary/5 border border-dashed border-border/40 hover:border-primary/30 rounded-xl"
						onClick={() => setCreateOpen(true)}
					>
						<Plus size={14} />
						New room
					</Button>
				) : (
					<form
						className="grid gap-3 p-3 rounded-xl bg-card/40 border border-border/40"
						onSubmit={(event) => {
							Promise.resolve(onCreateRoom(event))
								.then((created) => {
									if (created) {
										setCreateOpen(false);
									}
								})
								.catch(() => {
									// Keep the form open if create-room fails.
								});
						}}
					>
						<div className="grid gap-1.5">
							<label htmlFor="room-name-input" className="section-label px-0">
								Name
							</label>
							<Input
								id="room-name-input"
								autoFocus
								className="h-8 text-xs bg-muted/40 border-border/40 focus-visible:ring-primary/40 rounded-lg"
								onChange={(e) => onRoomNameDraftChange(e.target.value)}
								placeholder="Room name"
								value={roomNameDraft}
							/>
						</div>
						<div className="grid gap-1.5">
							<label htmlFor="room-kind-select" className="section-label px-0">
								Type
							</label>
							<Select
								onValueChange={(v) => onRoomKindDraftChange(v as RoomKind)}
								value={roomKindDraft}
							>
								<SelectTrigger
									id="room-kind-select"
									className="h-8 text-xs bg-muted/40 border-border/40 focus-visible:ring-primary/40 rounded-lg"
								>
									<SelectValue placeholder="Select type" />
								</SelectTrigger>
								<SelectContent className="bg-card border-border/40">
									{ROOM_KINDS.map((kind) => (
										<SelectItem key={kind} value={kind} className="text-xs">
											{kind.charAt(0).toUpperCase() + kind.slice(1)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex gap-2">
							<Button
								variant="ghost"
								size="sm"
								className="flex-1 h-8 text-[11px] font-bold uppercase tracking-wider rounded-lg"
								onClick={() => setCreateOpen(false)}
								type="button"
							>
								Cancel
							</Button>
							<Button
								size="sm"
								className="flex-1 h-8 text-[11px] font-bold uppercase tracking-wider rounded-lg bg-primary text-primary-foreground"
								type="submit"
							>
								Create
							</Button>
						</div>
					</form>
				)}
			</div>
		</aside>
	);
});

RoomSidebar.displayName = "RoomSidebar";
