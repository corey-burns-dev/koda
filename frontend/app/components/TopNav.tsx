import { ChevronDown, LogOut, Settings, UserCircle2 } from "lucide-react";
import Image from "next/image";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "../assets/logo.svg";
import type { AuthUser } from "../types";

type TopNavProps = {
  user: AuthUser | null;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function TopNav({ user, onOpenAuth, onOpenProfile, onOpenSettings, onLogout }: TopNavProps) {
  const initials = user?.username.slice(0, 2).toUpperCase() ?? "GU";

  return (
    <nav className="top-nav relative flex items-center justify-between px-4">
      <div className="flex items-center gap-2.5">
        <Image
          src={logo}
          alt="Koda Logo"
          width={28}
          height={28}
          className="rounded-lg shadow-lg shadow-primary/10"
        />
        <div className="flex flex-col -gap-1">
          <span className="text-base font-black tracking-tighter leading-none">Koda</span>
          <span className="text-[8px] font-bold text-primary uppercase tracking-[0.2em] opacity-80">
            Network
          </span>
        </div>
      </div>

      <div className="top-nav-actions flex items-center gap-2">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 px-2 gap-2 hover:bg-white/5">
                <Avatar className="h-7 w-7 border border-primary/40 bg-gradient-to-br from-primary to-orange-600">
                  <AvatarFallback className="text-[10px] font-black text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold truncate max-w-24">{user.username}</span>
                <ChevronDown size={14} className="opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onOpenProfile}>
                <UserCircle2 />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onOpenSettings}>
                <Settings />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout}>
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenAuth}
              type="button"
              className="text-xs font-bold hover:bg-white/5 transition-colors"
            >
              Log in
            </Button>
            <Button
              size="sm"
              onClick={onOpenAuth}
              type="button"
              className="text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-[0.98]"
            >
              Sign up
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
