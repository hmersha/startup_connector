"use client";

import { ReactNode } from "react";

type AppShellProps = {
  /** Optional page header title */
  title?: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Right rail content - rail only renders at lg+ if this has content */
  rightRail?: ReactNode;
  /** Main page content */
  children: ReactNode;
};

/**
 * AppShell - Layout wrapper for authenticated pages
 *
 * Features:
 * - Full-width app-like feel on desktop
 * - 2-column layout at lg+ with main content + context rail
 * - Rail only renders if content provided (no empty placeholders)
 * - Consistent spacing and responsive behavior
 */
export default function AppShell({
  title,
  subtitle,
  rightRail,
  children,
}: AppShellProps) {
  const hasRail = Boolean(rightRail);

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
      <div className={`app-shell-grid ${hasRail ? "app-shell-grid--with-rail" : ""}`}>
        <main className="app-shell-main">{children}</main>

        {hasRail && (
          <aside className="app-shell-rail app-shell-rail--open">
            {rightRail}
          </aside>
        )}
      </div>
    </div>
  );
}
