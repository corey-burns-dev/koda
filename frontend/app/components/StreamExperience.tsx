import {
	Check,
	Copy,
	Eye,
	Radio,
	RotateCcw,
	Search,
	StopCircle,
	Trash2,
	User,
	Video,
} from "lucide-react";
import { memo, type RefObject, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StreamObsConfig } from "../types";

type StreamExperienceProps = {
	canManageCurrentRoomStream: boolean;
	currentRoomStream: {
		id: string;
		live: boolean;
	} | null;
	knownStreamHostId: string | null;
	liveStreamTitle: string | null;
	obsConfig: StreamObsConfig | null;
	onDeleteCurrentRoomStream: () => void;
	obsIngestPreview: string | null;
	obsServerDraft: string;
	obsStreamKeyDraft: string;
	onFindStream: () => void;
	onObsServerDraftChange: (value: string) => void;
	onObsStreamKeyDraftChange: (value: string) => void;
	onResetCurrentRoomStream: () => void;
	onStartBroadcast: () => void;
	onStopBroadcast: () => void;
	streamMode: "idle" | "hosting" | "watching";
	streamPlaybackUrl: string | null;
	streamPlaybackVideoRef: RefObject<HTMLVideoElement | null>;
	streamTitleDraft: string;
	streamViewerCount: number;
	onStreamTitleDraftChange: (title: string) => void;
};

export const StreamExperience = memo(function StreamExperience({
	canManageCurrentRoomStream,
	currentRoomStream,
	knownStreamHostId,
	liveStreamTitle,
	obsConfig,
	onDeleteCurrentRoomStream,
	obsIngestPreview,
	obsServerDraft,
	obsStreamKeyDraft,
	onFindStream,
	onObsServerDraftChange,
	onObsStreamKeyDraftChange,
	onResetCurrentRoomStream,
	onStartBroadcast,
	onStopBroadcast,
	onStreamTitleDraftChange,
	streamMode,
	streamPlaybackUrl,
	streamPlaybackVideoRef,
	streamTitleDraft,
	streamViewerCount,
}: StreamExperienceProps) {
	const isHosting = streamMode === "hosting";
	const isIdle = streamMode === "idle";
	const hasLiveStream = Boolean(streamPlaybackUrl);
	const [copiedField, setCopiedField] = useState<
		"server" | "key" | "ingest" | null
	>(null);

	const serverValue =
		obsServerDraft.trim().length > 0
			? obsServerDraft.trim()
			: (obsConfig?.server_url ?? "");
	const streamKeyValue =
		obsStreamKeyDraft.trim().length > 0
			? obsStreamKeyDraft.trim()
			: (obsConfig?.stream_key ?? "");

	async function handleCopy(
		value: string,
		field: "server" | "key" | "ingest",
	): Promise<void> {
		if (!value) {
			return;
		}

		try {
			await navigator.clipboard.writeText(value);
			setCopiedField(field);
			window.setTimeout(() => {
				setCopiedField((current) => (current === field ? null : current));
			}, 1200);
		} catch {
			// Ignore clipboard errors.
		}
	}

	return (
		<Card className="overflow-hidden shadow-sm bg-card/40 border-border/40 backdrop-blur-xl rounded-xl animate-in">
			<CardHeader className="flex flex-col gap-3 p-4 pb-1">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div
							className={cn(
								"p-1.5 rounded-lg shadow-sm",
								hasLiveStream
									? "bg-red-500/10 text-red-500"
									: "bg-primary/10 text-primary",
							)}
						>
							<Radio
								size={16}
								className={hasLiveStream ? "animate-pulse" : ""}
							/>
						</div>
						<CardTitle className="text-base font-bold tracking-tight uppercase">
							{isHosting ? "Live Broadcast" : "Stream Discovery"}
						</CardTitle>
					</div>

					<div className="flex items-center gap-2">
						<Badge
							variant="outline"
							className="bg-muted/40 text-muted-foreground flex gap-1.5 items-center border-border/40 h-5 text-[9px] font-bold uppercase tracking-wider"
						>
							<User size={10} />
							Host: {knownStreamHostId ? knownStreamHostId.slice(0, 8) : "none"}
						</Badge>
						<Badge
							variant="outline"
							className="bg-primary/5 text-primary flex gap-1.5 items-center border-primary/20 h-5 text-[9px] font-bold uppercase tracking-wider"
						>
							<Eye size={10} />
							{streamViewerCount}{" "}
							{streamViewerCount === 1 ? "Viewer" : "Viewers"}
						</Badge>
					</div>
				</div>

				{liveStreamTitle && (
					<div className="flex items-center gap-1.5 px-0.5">
						<span className="text-xs font-bold truncate text-foreground">
							{liveStreamTitle}
						</span>
					</div>
				)}
			</CardHeader>

			<CardContent className="p-4 pt-2">
				<div className="relative overflow-hidden border aspect-video bg-black/40 rounded-xl border-border/40 group">
					<video
						ref={streamPlaybackVideoRef}
						className="object-cover w-full h-full"
						autoPlay
						playsInline
						muted={isHosting}
					/>

					{!hasLiveStream && !isHosting && (
						<div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[2px] gap-3">
							<Radio className="w-10 h-10 text-muted-foreground/30" />
							<div className="px-4 text-center">
								<p className="text-sm font-bold tracking-widest uppercase text-muted-foreground/60">
									Signal is offline
								</p>
								<p className="text-[11px] text-muted-foreground/40 font-medium">
									Try refreshing if you expect a host.
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={onFindStream}
								className="h-8 text-[11px] font-bold uppercase tracking-wider rounded-lg border-border/40 bg-background/50"
							>
								<Search size={14} className="mr-1.5" />
								Refresh
							</Button>
						</div>
					)}
				</div>

				{isIdle && (
					<div className="grid gap-3 pt-3 mt-4 border-t border-border/30">
						<div className="grid gap-1.5">
							<label htmlFor="streamTitleIdle" className="section-label">
								Broadcast title
							</label>
							<Input
								id="streamTitleIdle"
								placeholder="e.g. My stream"
								value={streamTitleDraft}
								onChange={(e) => onStreamTitleDraftChange(e.target.value)}
								className="h-8 text-xs rounded-lg bg-muted/40 border-border/40 focus-visible:ring-primary/40"
							/>
						</div>
						<div className="grid grid-cols-2 gap-3">
							<div className="grid gap-1.5">
								<label htmlFor="obsServerIdle" className="section-label">
									OBS Server
								</label>
								<Input
									id="obsServerIdle"
									placeholder="Leave blank for auto-generated"
									value={obsServerDraft}
									onChange={(e) => onObsServerDraftChange(e.target.value)}
									className="h-8 font-mono text-xs rounded-lg bg-muted/40 border-border/40"
								/>
							</div>
							<div className="grid gap-1.5">
								<label htmlFor="obsKeyIdle" className="section-label">
									OBS Stream key
								</label>
								<Input
									id="obsKeyIdle"
									type="password"
									placeholder="Leave blank for auto-generated"
									value={obsStreamKeyDraft}
									onChange={(e) => onObsStreamKeyDraftChange(e.target.value)}
									className="h-8 font-mono text-xs rounded-lg bg-muted/40 border-border/40"
								/>
							</div>
						</div>
						{obsIngestPreview && (
							<div className="grid gap-1.5">
								<span className="section-label">Ingest URL</span>
								<div className="flex gap-1.5">
									<Input
										readOnly
										value={obsIngestPreview}
										className="h-8 font-mono text-xs rounded-lg bg-muted/30 border-border/30 text-muted-foreground"
									/>
									<Button
										size="icon"
										variant="outline"
										className="w-8 h-8 rounded-lg shrink-0 border-border/30"
										onClick={() => handleCopy(obsIngestPreview, "ingest")}
									>
										{copiedField === "ingest" ? (
											<Check size={14} className="text-emerald-500" />
										) : (
											<Copy size={14} />
										)}
									</Button>
								</div>
							</div>
						)}
						<div className="flex items-center justify-between pt-1">
							<p className="text-[10px] text-muted-foreground/60 font-medium">
								Set server/key for a custom ingest, or leave blank to
								auto-generate.
							</p>
							<Button
								size="sm"
								onClick={onStartBroadcast}
								className="h-8 text-[11px] font-bold uppercase tracking-wider rounded-lg px-4"
							>
								<Video size={14} className="mr-1.5" />
								Go Live (OBS)
							</Button>
						</div>
						{canManageCurrentRoomStream && currentRoomStream && (
							<div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
								<div className="min-w-0">
									<p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
										Recovery tools
									</p>
									<p className="text-[11px] text-muted-foreground">
										Session {currentRoomStream.id} is{" "}
										{currentRoomStream.live ? "live" : "saved"}.
									</p>
								</div>
								<div className="flex items-center gap-2 shrink-0">
									<Button
										size="sm"
										variant="outline"
										onClick={onResetCurrentRoomStream}
										className="h-8 text-[11px] font-bold uppercase tracking-wider rounded-lg border-border/40"
									>
										<RotateCcw size={14} className="mr-1.5" />
										Reset
									</Button>
									<Button
										size="sm"
										variant="destructive"
										onClick={onDeleteCurrentRoomStream}
										className="h-8 text-[11px] font-bold uppercase tracking-wider rounded-lg px-3"
									>
										<Trash2 size={14} className="mr-1.5" />
										Delete
									</Button>
								</div>
							</div>
						)}
					</div>
				)}

				{isHosting && (
					<div className="grid gap-3 pt-3 mt-4 border-t border-border/30">
						<div className="grid gap-1.5">
							<label htmlFor="streamTitle" className="section-label">
								Broadcast Details
							</label>
							<Input
								id="streamTitle"
								placeholder="Set stream title..."
								value={streamTitleDraft}
								onChange={(e) => onStreamTitleDraftChange(e.target.value)}
								className="h-8 text-xs rounded-lg bg-muted/40 border-border/40 focus-visible:ring-primary/40"
							/>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="grid gap-1.5">
								<label htmlFor="obsServer" className="section-label">
									OBS Server
								</label>
								<div className="flex gap-1.5">
									<Input
										id="obsServer"
										readOnly
										value={serverValue}
										className="h-8 font-mono text-xs rounded-lg bg-muted/30 border-border/30 text-muted-foreground"
									/>
									<Button
										size="icon"
										variant="outline"
										className="w-8 h-8 rounded-lg shrink-0 border-border/30"
										onClick={() => handleCopy(serverValue, "server")}
									>
										{copiedField === "server" ? (
											<Check size={14} className="text-emerald-500" />
										) : (
											<Copy size={14} />
										)}
									</Button>
								</div>
							</div>
							<div className="grid gap-1.5">
								<label htmlFor="obsKey" className="section-label">
									OBS Key
								</label>
								<div className="flex gap-1.5">
									<Input
										id="obsKey"
										readOnly
										type="password"
										value={streamKeyValue}
										className="h-8 font-mono text-xs rounded-lg bg-muted/30 border-border/30 text-muted-foreground"
									/>
									<Button
										size="icon"
										variant="outline"
										className="w-8 h-8 rounded-lg shrink-0 border-border/30"
										onClick={() => handleCopy(streamKeyValue, "key")}
									>
										{copiedField === "key" ? (
											<Check size={14} className="text-emerald-500" />
										) : (
											<Copy size={14} />
										)}
									</Button>
								</div>
							</div>
						</div>

						<div className="flex items-center justify-between pt-1">
							<div className="flex flex-col">
								<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
									Status: Ready to broadcast
								</p>
								<p className="text-[10px] text-muted-foreground/40 font-medium">
									Connect your encoder to go live.
								</p>
							</div>
							<Button
								variant="destructive"
								size="sm"
								onClick={onStopBroadcast}
								className="h-8 text-[11px] font-bold uppercase tracking-wider rounded-lg px-4"
							>
								<StopCircle size={14} className="mr-1.5" />
								Stop
							</Button>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
});

StreamExperience.displayName = "StreamExperience";
