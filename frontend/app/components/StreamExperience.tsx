import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Eye, Radio, Search, StopCircle, User } from "lucide-react";
import { RefObject } from "react";

type StreamExperienceProps = {
  knownStreamHostId: string | null;
  onFindStream: () => void;
  onStartBroadcast: () => void;
  onStopBroadcast: () => void;
  streamLocalVideoRef: RefObject<HTMLVideoElement | null>;
  streamMode: "idle" | "hosting" | "watching";
  streamPreviewVideoRef: RefObject<HTMLVideoElement | null>;
  streamRemoteVideoRef: RefObject<HTMLVideoElement | null>;
  streamTitleDraft: string;
  streamViewerCount: number;
  onStreamTitleDraftChange: (title: string) => void;
};

export function StreamExperience({
  knownStreamHostId,
  onFindStream,
  onStartBroadcast,
  onStopBroadcast,
  onStreamTitleDraftChange,
  streamLocalVideoRef,
  streamMode,
  streamPreviewVideoRef,
  streamRemoteVideoRef,
  streamTitleDraft,
  streamViewerCount,
}: StreamExperienceProps) {
  const isHosting = streamMode === "hosting";

  return (
    <Card className="bg-black/20 border-white/5 backdrop-blur-sm overflow-hidden">
      <CardHeader className="flex flex-col gap-3 p-4 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                "p-1.5 rounded-lg",
                isHosting ? "bg-red-500/10 text-red-500" : "bg-primary/10 text-primary",
              )}
            >
              <Radio size={16} className={isHosting ? "animate-pulse" : ""} />
            </div>
            <CardTitle className="text-base font-bold">
              {isHosting ? "Live Broadcast" : "Stream Discovery"}
            </CardTitle>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-white/5 text-muted-foreground flex gap-1 items-center border-white/5 h-5 text-[10px]"
            >
              <User size={10} />
              Host: {knownStreamHostId ? knownStreamHostId.slice(0, 8) : "none"}
            </Badge>
            <Badge
              variant="outline"
              className="bg-white/5 text-muted-foreground flex gap-1 items-center border-white/5 h-5 text-[10px]"
            >
              <Eye size={10} />
              {streamViewerCount} viewers
            </Badge>
          </div>
        </div>

        <div className="flex gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
          <Input
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-xs h-8"
            onChange={(event) => onStreamTitleDraftChange(event.target.value)}
            placeholder="What are you streaming today?"
            value={streamTitleDraft}
          />
          <div className="flex gap-1.5">
            {isHosting ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={onStopBroadcast}
                className="gap-1.5 font-bold shadow-lg shadow-red-500/10 h-8 text-[11px]"
              >
                <StopCircle size={14} />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onStartBroadcast}
                className="gap-1.5 font-bold shadow-lg shadow-primary/10 bg-primary hover:bg-primary/90 h-8 px-3 text-[11px]"
              >
                <Radio size={14} />
                Go Live
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onFindStream}
              className="h-8 w-8 p-0 border-white/10"
            >
              <Search size={14} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 space-y-2">
            <h3 className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground px-1">
              {isHosting ? "Broadcast Feed" : "Main View"}
            </h3>
            <div className="relative aspect-video bg-black/60 rounded-xl border border-white/5 overflow-hidden shadow-2xl group transition-all hover:border-white/10">
              {isHosting ? (
                <video
                  autoPlay
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  ref={streamLocalVideoRef}
                />
              ) : (
                <video
                  autoPlay
                  className="w-full h-full object-cover"
                  playsInline
                  ref={streamRemoteVideoRef}
                />
              )}
              {isHosting && (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-600/90 text-white animate-pulse shadow-lg">
                  <Radio size={10} />
                  <span className="text-[9px] font-black uppercase tracking-tighter">Live</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground px-1">
              Local Preview
            </h3>
            <div className="relative aspect-[4/3] bg-black/40 rounded-xl border border-white/5 overflow-hidden shadow-lg transition-all hover:border-white/10">
              <video
                autoPlay
                className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                muted
                playsInline
                ref={streamPreviewVideoRef}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
                    Preview Only
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground/60 leading-relaxed italic text-center px-2">
              Check your framing and lighting before going live.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
