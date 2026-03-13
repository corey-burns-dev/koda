import { memo } from "react";
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

function StatusRow({
	state,
	label,
}: {
	state: string | boolean;
	label: string;
}) {
	const healthy = state === "connected" || state === true;
	const warning = state === "connecting" || state === "reconnecting";
	const loginRequired = state === "login required";

	return (
		<div className="flex items-center gap-2 px-1">
			<span
				className={cn(
					"w-1.5 h-1.5 rounded-full shrink-0",
					healthy
						? "bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]"
						: warning || loginRequired
							? "bg-amber-500 animate-pulse"
							: "bg-red-500/60",
				)}
			/>
			<span className="text-[10px] text-muted-foreground/60 flex-1 truncate font-bold uppercase tracking-wider">
				{label}
			</span>
			<span
				className={cn(
					"text-[10px] font-bold uppercase tracking-wider",
					healthy
						? "text-emerald-500/70"
						: warning || loginRequired
							? "text-amber-500/70"
							: "text-red-500/50",
				)}
			>
				{healthy ? "ok" : loginRequired ? "auth" : warning ? "…" : "—"}
			</span>
		</div>
	);
}

export const RightNav = memo(function RightNav({
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
		<aside
			className="right-panel animate-in"
			style={{ animationDelay: "250ms" }}
		>
			{/* Profile Card */}
			<div className="flex items-center gap-3 p-3 border shadow-sm rounded-xl bg-card/40 border-border/40">
				<Avatar className="w-8 h-8 border shrink-0 border-primary/30 bg-linear-to-br from-primary to-primary/60">
					<AvatarFallback className="text-[10px] font-extrabold text-primary-foreground">
						{initials}
					</AvatarFallback>
				</Avatar>
				<div className="flex flex-col flex-1 min-w-0">
					<span className="text-[13px] font-bold truncate leading-tight">
						{user?.username ?? "Anonymous"}
					</span>
					<span className="text-[10px] text-muted-foreground/60 truncate leading-tight font-medium">
						{user?.email ?? "Not signed in"}
					</span>
				</div>
			</div>

			{/* Connections Section */}
			<div className="space-y-2">
				<p className="px-1 section-label">System Status</p>
				<div className="grid gap-1.5 p-2 rounded-xl bg-muted/30 border border-border/40">
					<StatusRow state={backendHealthy} label="API" />
					<StatusRow state={chatSocketState} label="Chat" />
					<StatusRow state={signalSocketState} label="Signal" />
				</div>
			</div>

			{/* Activity Log */}
			<div className="flex flex-col flex-1 space-y-2 overflow-hidden">
				<p className="px-1 section-label">Activity Log</p>
				<div className="flex-1 overflow-y-auto p-2.5 rounded-xl bg-muted/20 border border-border/40">
					<p className="text-[11px] text-muted-foreground/70 leading-relaxed font-medium italic">
						{statusNote || "No recent activity."}
					</p>
				</div>
			</div>

			{/* Action Area */}
			<div className="pt-2">
				{user ? (
					<Button
						variant="ghost"
						size="sm"
						className="w-full h-8 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 hover:text-destructive hover:bg-destructive/5 border border-transparent hover:border-destructive/20 rounded-xl transition-all"
						onClick={onLogout}
					>
						Sign out
					</Button>
				) : (
					<Button
						size="sm"
						className="w-full h-8 text-[11px] font-bold uppercase tracking-wider bg-primary text-primary-foreground shadow-lg shadow-primary/20 rounded-xl"
						onClick={onOpenAuth}
					>
						Sign in
					</Button>
				)}
			</div>
		</aside>
	);
});

RightNav.displayName = "RightNav";
