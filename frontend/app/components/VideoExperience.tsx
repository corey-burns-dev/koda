import { Users, Video, VideoOff } from "lucide-react";
import { RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type VideoExperienceProps = {
  onJoinVideoRoom: () => void;
  onLeaveVideoRoom: () => void;
  getRemoteVideoStream: (remoteUserId: string) => MediaStream | null;
  videoJoined: boolean;
  videoLocalVideoRef: RefObject<HTMLVideoElement | null>;
  videoParticipantCount: number;
  videoRemoteUserIds: string[];
};

export function VideoExperience({
  getRemoteVideoStream,
  onJoinVideoRoom,
  onLeaveVideoRoom,
  videoJoined,
  videoLocalVideoRef,
  videoParticipantCount,
  videoRemoteUserIds,
}: VideoExperienceProps) {
  return (
    <Card className="bg-black/20 border-white/5 backdrop-blur-sm overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <Video size={16} />
          </div>
          <CardTitle className="text-base font-bold">Video Conference</CardTitle>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge
            variant="secondary"
            className="bg-white/5 text-muted-foreground flex gap-1 items-center px-1.5 py-0.5 text-[10px]"
          >
            <Users size={10} />
            {videoParticipantCount} participants
          </Badge>
          {videoJoined ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={onLeaveVideoRoom}
              className="gap-1.5 font-bold shadow-lg shadow-red-500/10 h-8 text-[11px]"
            >
              <VideoOff size={14} />
              Leave Room
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onJoinVideoRoom}
              className="gap-1.5 font-bold shadow-lg shadow-primary/10 bg-primary hover:bg-primary/90 h-8 text-[11px]"
            >
              <Video size={14} />
              Join Room
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="group relative aspect-video bg-black/40 rounded-xl border border-white/5 overflow-hidden transition-all hover:border-primary/30">
            <video
              autoPlay
              className="w-full h-full object-cover"
              muted
              playsInline
              ref={videoLocalVideoRef}
            />
            <div className="absolute bottom-2.5 left-2.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
              <span className="text-[9px] font-bold uppercase tracking-wider">You (Local)</span>
            </div>
            {!videoJoined && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <p className="text-[10px] text-muted-foreground italic">Camera preview</p>
              </div>
            )}
          </div>

          {videoRemoteUserIds.map((remoteUserId) => (
            <div
              key={remoteUserId}
              className="group relative aspect-video bg-black/40 rounded-xl border border-white/5 overflow-hidden transition-all hover:border-primary/30"
            >
              <video
                autoPlay
                className="w-full h-full object-cover"
                playsInline
                ref={(element) => {
                  if (!element) return;
                  element.srcObject = getRemoteVideoStream(remoteUserId);
                }}
              />
              <div className="absolute bottom-2.5 left-2.5 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                <span className="text-[9px] font-bold uppercase tracking-wider truncate max-w-[80px] block">
                  {remoteUserId}
                </span>
              </div>
            </div>
          ))}

          {videoRemoteUserIds.length === 0 && videoJoined && (
            <div className="aspect-video flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 text-center p-4">
              <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center mb-2">
                <Users size={18} className="text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">
                Waiting for others to join...
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
