import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthUser } from "../types";

type RightNavProps = {
  backendHealthy: boolean;
  chatSocketState: string;
  signalSocketState: string;
  statusNote: string;
  user: AuthUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
};

function StatusRow({ state, label }: { state: string | boolean; label: string }) {
  const healthy = state === "connected" || state === true;
  const warning = state === "connecting" || state === "reconnecting";

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          healthy
            ? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
            : warning
              ? "bg-amber-500 animate-pulse"
              : "bg-red-500/60",
        )}
      />
      <span className="text-[10px] text-muted-foreground/60 flex-1 truncate">{label}</span>
      <span
        className={cn(
          "text-[9px] font-medium",
          healthy ? "text-emerald-500/70" : warning ? "text-amber-500/70" : "text-red-500/50",
        )}
      >
        {healthy ? "ok" : warning ? "…" : "—"}
      </span>
    </div>
  );
}

export function RightNav({
  backendHealthy,
  chatSocketState,
  signalSocketState,
  statusNote,
  user,
  onOpenAuth,
  onLogout,
}: RightNavProps) {
  const initials = (user?.username ?? "GU").slice(0, 2).toUpperCase();

  return (
    <aside className="right-panel">
      {/* Profile */}
      <div className="flex items-center gap-2 p-1.5 rounded-md bg-white/[0.03] border border-white/[0.05]">
        <Avatar className="h-6 w-6 shrink-0 border border-primary/30 bg-gradient-to-br from-primary to-orange-600">
          <AvatarFallback className="text-[9px] font-bold text-white">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-semibold truncate leading-tight">
            {user?.username ?? "Anonymous"}
          </span>
          <span className="text-[9px] text-muted-foreground/50 truncate leading-tight">
            {user?.email ?? "Not signed in"}
          </span>
        </div>
      </div>

      {/* Connections */}
      <div className="space-y-1.5">
        <p className="section-label">Connections</p>
        <div className="grid gap-1 px-0.5">
          <StatusRow state={backendHealthy} label="API" />
          <StatusRow state={chatSocketState} label="Chat" />
          <StatusRow state={signalSocketState} label="Signal" />
        </div>
      </div>

      {/* Activity */}
      <div className="flex-1 space-y-1.5">
        <p className="section-label">Activity</p>
        <p className="text-[10px] text-muted-foreground/60 leading-relaxed italic px-0.5">
          {statusNote}
        </p>
      </div>

      {/* Auth action */}
      <div>
        {user ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 text-[10px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/[0.04]"
            onClick={onLogout}
          >
            Sign out
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full h-7 text-[10px] font-semibold shadow-lg shadow-primary/10"
            onClick={onOpenAuth}
          >
            Sign in
          </Button>
        )}
      </div>
    </aside>
  );
}
