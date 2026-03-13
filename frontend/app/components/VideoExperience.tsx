import { Mic, Video, VideoOff } from "lucide-react";
import { memo, type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VideoExperienceProps = {
	getRemoteVideoStream: (userId: string) => MediaStream | null;
	onJoinVideoRoom: () => void;
	onLeaveVideoRoom: () => void;
	videoJoined: boolean;
	videoLocalVideoRef: RefObject<HTMLVideoElement | null>;
	videoParticipantCount: number;
	videoRemoteUserIds: string[];
};

export const VideoExperience = memo(function VideoExperience({
	getRemoteVideoStream,
	onJoinVideoRoom,
	onLeaveVideoRoom,
	videoJoined,
	videoLocalVideoRef,
	videoParticipantCount,
	videoRemoteUserIds,
}: VideoExperienceProps) {
	return (
		<Card className="overflow-hidden shadow-sm bg-card/40 border-border/40 backdrop-blur-xl rounded-xl animate-in">
			<CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
				<div className="flex items-center gap-3">
					<div className="p-1.5 rounded-lg bg-primary/10 text-primary shadow-sm">
						<Video size={16} />
					</div>
					<CardTitle className="text-base font-bold tracking-tight uppercase">
						Video Room
					</CardTitle>
				</div>
				<Badge
					variant="outline"
					className="bg-primary/5 text-primary border-primary/20 h-5 text-[9px] font-bold uppercase tracking-wider"
				>
					{videoParticipantCount}{" "}
					{videoParticipantCount === 1 ? "Participant" : "Participants"}
				</Badge>
			</CardHeader>
			<CardContent className="p-4 pt-0">
				<div className="grid grid-cols-2 gap-3 md:grid-cols-3">
					{videoJoined && (
						<div className="relative overflow-hidden border shadow-md aspect-video bg-black/40 rounded-xl border-primary/30">
							<video
								ref={videoLocalVideoRef}
								className="object-cover w-full h-full -scale-x-100"
								autoPlay
								playsInline
								muted
							/>
							<div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
								<span className="text-[9px] font-bold text-white uppercase tracking-wider">
									You (Local)
								</span>
							</div>
						</div>
					)}

					{videoRemoteUserIds.map((remoteUserId) => {
						const stream = getRemoteVideoStream(remoteUserId);
						return (
							<div
								key={remoteUserId}
								className="relative overflow-hidden border aspect-video bg-black/40 rounded-xl border-border/40"
							>
								{stream ? (
									<video
										className="object-cover w-full h-full"
										autoPlay
										playsInline
										ref={(el) => {
											if (el) el.srcObject = stream;
										}}
									/>
								) : (
									<div className="flex items-center justify-center h-full">
										<VideoOff size={20} className="text-muted-foreground/20" />
									</div>
								)}
								<div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm border border-white/10">
									<span className="text-[9px] font-bold text-white uppercase tracking-wider">
										User {remoteUserId.slice(0, 6)}
									</span>
								</div>
							</div>
						);
					})}

					{!videoJoined && videoRemoteUserIds.length === 0 && (
						<div className="flex flex-col items-center justify-center gap-3 border border-dashed col-span-full aspect-21/9 bg-muted/10 rounded-xl border-border/40">
							<Video className="w-10 h-10 text-muted-foreground/20" />
							<p className="text-sm font-bold tracking-widest uppercase text-muted-foreground/40">
								Room is empty
							</p>
						</div>
					)}
				</div>

				<div className="flex justify-center gap-3 pt-3 mt-4 border-t border-border/30">
					{!videoJoined ? (
						<Button
							onClick={onJoinVideoRoom}
							className="px-6 text-xs font-bold tracking-wider uppercase shadow-lg h-9 rounded-xl bg-primary text-primary-foreground shadow-primary/20"
						>
							<Video size={16} className="mr-2" />
							Join Video
						</Button>
					) : (
						<>
							<Button
								variant="outline"
								size="icon"
								className="h-9 w-9 rounded-xl border-border/40 bg-muted/20"
							>
								<Mic size={16} />
							</Button>
							<Button
								variant="destructive"
								onClick={onLeaveVideoRoom}
								className="px-6 text-xs font-bold tracking-wider uppercase shadow-lg h-9 rounded-xl shadow-destructive/10"
							>
								<VideoOff size={16} className="mr-2" />
								Leave Room
							</Button>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
});

VideoExperience.displayName = "VideoExperience";
