import { ChevronDown, LogOut, Settings, UserCircle2, Zap } from "lucide-react";
import { memo } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AuthUser } from "../types";

type TopNavProps = {
	user: AuthUser | null;
	onOpenAuth: () => void;
	onOpenProfile: () => void;
	onOpenSettings: () => void;
	onLogout: () => void;
};

export const TopNav = memo(function TopNav({
	user,
	onOpenAuth,
	onOpenProfile,
	onOpenSettings,
	onLogout,
}: TopNavProps) {
	const initials = user?.username.slice(0, 2).toUpperCase() ?? "GU";

	return (
		<nav className="relative top-nav animate-in">
			<div className="flex items-center gap-3">
				<div className="flex items-center justify-center w-8 h-8 shadow-lg rounded-xl bg-linear-to-br from-primary to-primary/60 text-primary-foreground shadow-primary/20">
					<Zap className="w-4 h-4 fill-current" />
				</div>
				<div className="flex flex-col -space-y-1">
					<span className="text-lg font-black leading-none tracking-tighter">
						PUNCH
					</span>
					<span className="text-[9px] font-bold text-primary uppercase tracking-[0.25em] opacity-90">
						Realtime
					</span>
				</div>
			</div>

			<div className="flex items-center gap-3">
				{user ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-9 px-2.5 gap-2.5 hover:bg-muted/60 rounded-xl transition-all border border-transparent hover:border-border/40"
							>
								<Avatar className="border h-7 w-7 border-primary/40 bg-linear-to-br from-primary to-primary/60">
									<AvatarFallback className="text-[10px] font-black text-primary-foreground">
										{initials}
									</AvatarFallback>
								</Avatar>
								<span className="text-xs font-bold tracking-tight truncate max-w-24">
									{user.username}
								</span>
								<ChevronDown size={14} className="opacity-40" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-52 rounded-xl border-border/40 bg-card/95 backdrop-blur-xl"
						>
							<DropdownMenuItem
								onClick={onOpenProfile}
								className="gap-2.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
							>
								<UserCircle2 size={16} />
								Profile
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={onOpenSettings}
								className="gap-2.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider"
							>
								<Settings size={16} />
								Settings
							</DropdownMenuItem>
							<DropdownMenuSeparator className="bg-border/40" />
							<DropdownMenuItem
								onClick={onLogout}
								className="gap-2.5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-destructive focus:text-destructive"
							>
								<LogOut size={16} />
								Log out
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							onClick={onOpenAuth}
							type="button"
							className="px-4 text-xs font-bold tracking-widest uppercase rounded-lg hover:bg-muted/60"
						>
							Log in
						</Button>
						<Button
							size="sm"
							onClick={onOpenAuth}
							type="button"
							className="text-xs font-bold uppercase tracking-widest bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-[0.98] rounded-lg px-4"
						>
							Sign up
						</Button>
					</div>
				)}
			</div>
		</nav>
	);
});

TopNav.displayName = "TopNav";
