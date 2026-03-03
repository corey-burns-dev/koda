"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const HTTP_BASE =
  process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8080";

type AuthModalProps = {
  onClose: () => void;
  onSuccess: (user: { id: string, username: string, email: string }) => void;
};

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = tab === "login" 
      ? { email, password }
      : { username, email, password };

    if (tab === "register" && password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${HTTP_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        let message = text || "Authentication failed";
        try {
          const parsed = JSON.parse(text) as { error?: string };
          if (parsed?.error) {
            message = parsed.error;
          }
        } catch {
          // Keep plain-text error responses.
        }
        throw new Error(message);
      }

      const user = await response.json();
      localStorage.setItem("punch.user", JSON.stringify(user));
      localStorage.setItem("punch.user_id", user.id);
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px] bg-card border-white/10 shadow-2xl backdrop-blur-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pt-4 px-1">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              {tab === "login" ? "Welcome back" : "Create account"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/70">
              {tab === "login" 
                ? "Enter your credentials to access your account." 
                : "Fill in the details below to join the community."}
            </DialogDescription>
          </DialogHeader>

          <Tabs 
            value={tab} 
            onValueChange={(v) => {
              setTab(v as "login" | "register");
              setError(null);
            }} 
            className="w-full mt-2"
          >
            <TabsList className="grid w-full grid-cols-2 bg-black/30 p-1">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary data-[state=active]:text-white">Log in</TabsTrigger>
              <TabsTrigger value="register" className="data-[state=active]:bg-primary data-[state=active]:text-white">Sign up</TabsTrigger>
            </TabsList>

            <div className="grid gap-4 py-6 px-1">
              {error && (
                <div className="text-red-500 text-xs font-medium px-1">
                  {error}
                </div>
              )}
              {tab === "register" && (
                <div className="grid gap-2">
                  <label htmlFor="username" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Username</label>
                  <Input 
                    id="username"
                    placeholder="johndoe" 
                    type="text" 
                    autoComplete="username" 
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-black/20 border-white/10 focus-visible:ring-primary/50 h-11"
                  />
                </div>
              )}
              <div className="grid gap-2">
                <label htmlFor="email" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email</label>
                <Input 
                  id="email"
                  placeholder="name@example.com" 
                  type="email" 
                  autoComplete="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-black/20 border-white/10 focus-visible:ring-primary/50 h-11"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="password" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Password</label>
                <Input 
                  id="password"
                  placeholder="••••••••" 
                  type="password" 
                  autoComplete={tab === "login" ? "current-password" : "new-password"} 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-black/20 border-white/10 focus-visible:ring-primary/50 h-11"
                />
              </div>
              {tab === "register" && (
                <div className="grid gap-2">
                  <label htmlFor="confirm-password" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Confirm Password</label>
                  <Input 
                    id="confirm-password"
                    placeholder="Confirm password" 
                    type="password" 
                    autoComplete="new-password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-black/20 border-white/10 focus-visible:ring-primary/50 h-11"
                  />
                </div>
              )}
            </div>
          </Tabs>

          <DialogFooter className="px-1 pb-2">
            <Button variant="ghost" onClick={onClose} type="button" className="text-muted-foreground">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="font-bold px-8 bg-primary hover:bg-primary/90 shadow-[0_0_20px_rgba(245,122,77,0.2)]"
            >
              {loading ? "Please wait..." : (tab === "login" ? "Log in" : "Create account")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
