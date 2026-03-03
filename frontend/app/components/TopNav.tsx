type TopNavProps = {
  onOpenAuth: () => void;
};

export function TopNav({ onOpenAuth }: TopNavProps) {
  return (
    <nav className="top-nav">
      <div className="top-nav-brand">
        <div className="brand-mark">P</div>
        <span className="brand-name">Punch</span>
      </div>

      <div className="top-nav-actions">
        <button className="btn-ghost btn-sm" onClick={onOpenAuth} type="button">
          Log in
        </button>
        <button className="btn-sm" onClick={onOpenAuth} type="button">
          Sign up
        </button>
      </div>
    </nav>
  );
}
