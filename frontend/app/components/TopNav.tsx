import Image from "next/image";
import { Radio, Video, MessageSquare, Hash } from "lucide-react";

import logo from "../assets/logo.jpeg";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrowseTab } from "../types";

type TopNavProps = {
  tab: BrowseTab;
  onTabChange: (tab: BrowseTab) => void;
  onOpenAuth: () => void;
};

const TABS: { id: BrowseTab; label: string; icon: any }[] = [
  { id: "all", label: "All", icon: Hash },
  { id: "live", label: "Live", icon: Radio },
  { id: "video", label: "Video", icon: Video },
  { id: "text", label: "Text", icon: MessageSquare },
];

export function TopNav({ tab, onTabChange, onOpenAuth }: TopNavProps) {
  return (
    <nav className="top-nav relative flex items-center justify-between px-4 gap-4">
      <div className="flex items-center gap-4 flex-1">
        <Tabs value={tab} onValueChange={(v) => onTabChange(v as BrowseTab)} className="w-full max-w-md">
          <TabsList className="grid w-full grid-cols-4 bg-black/40 p-1 h-9">
            {TABS.map(({ id, label, icon: Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                aria-label={label}
                className="py-1 px-0 data-[state=active]:bg-primary data-[state=active]:text-white transition-all text-xs flex items-center gap-1.5"
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2.5 shrink-0 ml-2">
          <Image src={logo} alt="Punch Logo" width={28} height={28} className="rounded-lg shadow-lg shadow-primary/10" />
          <div className="flex flex-col -gap-1 hidden md:flex">
            <span className="text-base font-black tracking-tighter leading-none">Punch</span>
            <span className="text-[8px] font-bold text-primary uppercase tracking-[0.2em] opacity-80">Network</span>
          </div>
        </div>
      </div>

      <div className="top-nav-actions flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onOpenAuth} type="button" className="text-xs font-bold hover:bg-white/5 transition-colors">
          Log in
        </Button>
        <Button size="sm" onClick={onOpenAuth} type="button" className="text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-[0.98]">
          Sign up
        </Button>
      </div>
    </nav>
  );
}
