import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Activity, Shield, Wifi, WifiOff } from "lucide-react";

type RightNavProps = {
  backendHealthy: boolean;
  chatSocketState: string;
  signalSocketState: string;
  statusNote: string;
  userId: string;
  onOpenAuth: () => void;
};

function StatusDot({ state }: { state: string | boolean }) {
  const isHealthy = state === "connected" || state === true;
  const isWarning = state === "connecting" || state === "reconnecting";
  
  return (
    <span className={cn(
      "w-2 h-2 rounded-full",
      isHealthy ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : 
      isWarning ? "bg-amber-500 animate-pulse" : "bg-red-500"
    )} />
  );
}

export function RightNav({
  backendHealthy,
  chatSocketState,
  signalSocketState,
  statusNote,
  userId,
  onOpenAuth,
}: RightNavProps) {
  const initials = userId.slice(0, 2).toUpperCase();

  return (
    <aside className="right-panel">
      {/* Profile */}
      <div className="space-y-3">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Profile</h3>
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/5 shadow-inner">
          <Avatar className="h-9 w-9 border-2 border-primary/20 bg-gradient-to-br from-primary to-orange-600">
            <AvatarFallback className="text-white font-black">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold truncate">Anonymous User</span>
            <code className="text-[10px] text-muted-foreground/60 truncate" title={userId}>{userId.slice(0, 12)}</code>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-[11px] border-white/10 hover:border-primary/50 hover:bg-primary/5 transition-all"
          onClick={onOpenAuth}
        >
          Sign in to save progress
        </Button>
      </div>

      <Separator className="bg-white/5" />

      {/* Connections */}
      <div className="space-y-3">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
          <Activity size={12} className="text-primary" />
          Network Status
        </h3>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-black/20 border border-white/5">
            <div className="flex items-center gap-2.5">
              <StatusDot state={backendHealthy} />
              <span className="text-[11px] font-medium text-muted-foreground">API Backend</span>
            </div>
            <Badge variant="outline" className={cn(
              "text-[9px] h-4 px-1 border-transparent",
              backendHealthy ? "text-emerald-500 bg-emerald-500/10" : "text-red-500 bg-red-500/10"
            )}>
              {backendHealthy ? <Wifi size={8} className="mr-1" /> : <WifiOff size={8} className="mr-1" />}
              {backendHealthy ? "ONLINE" : "OFFLINE"}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-black/20 border border-white/5">
            <div className="flex items-center gap-2.5">
              <StatusDot state={chatSocketState} />
              <span className="text-[11px] font-medium text-muted-foreground">Chat Stream</span>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
              {chatSocketState}
            </span>
          </div>

          <div className="flex items-center justify-between p-1.5 px-2.5 rounded-lg bg-black/20 border border-white/5">
            <div className="flex items-center gap-2.5">
              <StatusDot state={signalSocketState} />
              <span className="text-[11px] font-medium text-muted-foreground">Signaling</span>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
              {signalSocketState}
            </span>
          </div>
        </div>
      </div>

      <Separator className="bg-white/5" />

      {/* Status note */}
      <div className="space-y-3">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-2">
          <Shield size={12} className="text-primary" />
          System Activity
        </h3>
        <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground leading-relaxed italic">
            "{statusNote}"
          </p>
        </div>
      </div>
    </aside>
  );
}
