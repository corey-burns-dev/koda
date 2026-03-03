type RightNavProps = {
  backendHealthy: boolean;
  chatSocketState: string;
  signalSocketState: string;
  statusNote: string;
  userId: string;
  onOpenAuth: () => void;
};

function dotClass(state: string): string {
  if (state === "connected") return "status-dot ok";
  if (state === "error") return "status-dot err";
  return "status-dot warn";
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
      <div>
        <p className="section-label">Profile</p>
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div className="user-meta">
            <strong>Anonymous</strong>
            <small title={userId}>{userId.slice(0, 12)}…</small>
          </div>
        </div>
        <button
          className="btn-ghost btn-sm"
          onClick={onOpenAuth}
          style={{ marginTop: "0.6rem", width: "100%" }}
          type="button"
        >
          Log in / Sign up
        </button>
      </div>

      {/* Connections */}
      <div>
        <p className="section-label">Connections</p>
        <div className="status-rows">
          <div className="status-row">
            <span className="status-label">
              <span className={backendHealthy ? "status-dot ok" : "status-dot err"} />
              Backend
            </span>
            <span style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
              {backendHealthy ? "healthy" : "down"}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">
              <span className={dotClass(chatSocketState)} />
              Chat
            </span>
            <span style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
              {chatSocketState}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">
              <span className={dotClass(signalSocketState)} />
              Signal
            </span>
            <span style={{ color: "var(--muted)", fontSize: "0.76rem" }}>
              {signalSocketState}
            </span>
          </div>
        </div>
      </div>

      {/* Status note */}
      <div>
        <p className="section-label">Activity</p>
        <p className="status-note">{statusNote}</p>
      </div>
    </aside>
  );
}
