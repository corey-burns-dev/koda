import Image from "next/image";
import logo from "../assets/logo.jpeg";
import { Button } from "@/components/ui/button";

type TopNavProps = {
  onOpenAuth: () => void;
};

export function TopNav({ onOpenAuth }: TopNavProps) {
  return (
    <nav className="top-nav">
      <div className="flex items-center gap-2">
        <Image src={logo} alt="Punch Logo" width={32} height={32} className="rounded-lg" />
        <span className="text-xl font-black tracking-tighter">Punch</span>
      </div>

      <div className="top-nav-actions flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onOpenAuth} type="button">
          Log in
        </Button>
        <Button size="sm" onClick={onOpenAuth} type="button">
          Sign up
        </Button>
      </div>
    </nav>
  );
}
