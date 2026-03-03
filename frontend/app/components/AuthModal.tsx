"use client";

import { useState } from "react";

type AuthModalProps = {
  onClose: () => void;
};

export function AuthModal({ onClose }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "register">("login");

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal">
        <h2>{tab === "login" ? "Welcome back" : "Create account"}</h2>

        <div className="modal-tabs">
          <button
            className={`modal-tab${tab === "login" ? " active" : ""}`}
            onClick={() => setTab("login")}
            type="button"
          >
            Log in
          </button>
          <button
            className={`modal-tab${tab === "register" ? " active" : ""}`}
            onClick={() => setTab("register")}
            type="button"
          >
            Sign up
          </button>
        </div>

        <div className="modal-fields">
          {tab === "register" && (
            <input placeholder="Username" type="text" autoComplete="username" />
          )}
          <input placeholder="Email" type="email" autoComplete="email" />
          <input
            placeholder="Password"
            type="password"
            autoComplete={tab === "login" ? "current-password" : "new-password"}
          />
          {tab === "register" && (
            <input
              placeholder="Confirm password"
              type="password"
              autoComplete="new-password"
            />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost btn-sm" onClick={onClose} type="button">
            Cancel
          </button>
          <button type="button">
            {tab === "login" ? "Log in" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}
