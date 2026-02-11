"use client";

import { useState } from "react";

type AppShellProps = {
  title?: string;
  subtitle?: string;
  rightRail?: React.ReactNode;
  children: React.ReactNode;
};

export default function AppShell({ title, subtitle, rightRail, children }: AppShellProps) {
  const [showRail, setShowRail] = useState(false);

  return (
    <div className="app-shell">
      {/* Page Header */}
      {(title || subtitle) && (
        <header className="app-shell-header">
          {title && <h1 className="app-shell-title">{title}</h1>}
          {subtitle && <p className="app-shell-subtitle">{subtitle}</p>}
        </header>
      )}

      {/* Main Grid */}
      <div className={`app-shell-grid ${rightRail ? "app-shell-grid--with-rail" : ""}`}>
        {/* Main Content */}
        <main className="app-shell-main">{children}</main>

        {/* Right Rail */}
        {rightRail && (
          <>
            {/* Mobile Toggle */}
            <button
              className="app-shell-rail-toggle"
              onClick={() => setShowRail(!showRail)}
              aria-expanded={showRail}
              aria-controls="app-shell-rail"
            >
              <span>{showRail ? "Hide" : "More"}</span>
              <svg
                className={`app-shell-rail-toggle-icon ${showRail ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Rail Content */}
            <aside
              id="app-shell-rail"
              className={`app-shell-rail ${showRail ? "app-shell-rail--open" : ""}`}
            >
              {rightRail}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
