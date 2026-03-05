"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AuthUser } from "../types";

type AuthModalProps = {
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
};

export function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const HTTP_BASE =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? `http://${window.location.hostname}:8080`)
      : (process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8080");

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
    const body = tab === "login" ? { email, password } : { username, email, password };

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
      localStorage.setItem("koda.user", JSON.stringify(user));
      localStorage.setItem("koda.user_id", user.id);
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
      <DialogContent className="sm:max-w-[400px] bg-card/95 border-border/40 shadow-2xl backdrop-blur-2xl rounded-2xl animate-in">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="pt-4 px-1">
            <DialogTitle className="text-2xl font-black tracking-tighter uppercase">
              {tab === "login" ? "Welcome" : "Join Punch"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/70 font-medium text-sm leading-snug">
              {tab === "login"
                ? "Enter your credentials to access the network."
                : "Create an account to join the realtime community."}
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={(v) => {
              setTab(v as "login" | "register");
              setError(null);
            }}
            className="w-full mt-4"
          >
            <TabsList className="grid w-full grid-cols-2 bg-muted/40 p-1 rounded-xl border border-border/40">
              <TabsTrigger
                value="login"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg font-bold uppercase tracking-wider text-[10px]"
              >
                Log in
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg font-bold uppercase tracking-wider text-[10px]"
              >
                Sign up
              </TabsTrigger>
            </TabsList>

            <div className="grid gap-4 py-6 px-1">
              {error && (
                <div className="text-destructive text-[11px] font-bold uppercase tracking-wider bg-destructive/10 p-2.5 rounded-lg border border-destructive/20">
                  {error}
                </div>
              )}
              {tab === "register" && (
                <div className="grid gap-1.5">
                  <label htmlFor="username" className="section-label px-0">
                    Username
                  </label>
                  <Input
                    id="username"
                    placeholder="johndoe"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-muted/40 border-border/40 focus-visible:ring-primary/40 h-10 rounded-xl text-sm"
                  />
                </div>
              )}
              <div className="grid gap-1.5">
                <label htmlFor="email" className="section-label px-0">
                  Email
                </label>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-muted/40 border-border/40 focus-visible:ring-primary/40 h-10 rounded-xl text-sm"
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="password" className="section-label px-0">
                  Password
                </label>
                <Input
                  id="password"
                  placeholder="••••••••"
                  type="password"
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-muted/40 border-border/40 focus-visible:ring-primary/40 h-10 rounded-xl text-sm"
                />
              </div>
              {tab === "register" && (
                <div className="grid gap-1.5">
                  <label htmlFor="confirm-password" className="section-label px-0">
                    Confirm Password
                  </label>
                  <Input
                    id="confirm-password"
                    placeholder="Confirm password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-muted/40 border-border/40 focus-visible:ring-primary/40 h-10 rounded-xl text-sm"
                  />
                </div>
              )}
            </div>
          </Tabs>

          <DialogFooter className="px-1 pb-2 flex-col sm:flex-row gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              type="button"
              className="text-muted-foreground font-bold uppercase tracking-wider text-[11px] rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="font-bold uppercase tracking-widest text-[11px] px-8 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl h-10"
            >
              {loading ? "Processing..." : tab === "login" ? "Log in" : "Create account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
