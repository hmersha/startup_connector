"use client";

import { ReactNode } from "react";

type PageShellProps = {
  /** Optional page header title */
  title?: string;
  /** Optional subtitle below title */
  subtitle?: string;
  /** Right rail content - rail only renders if this has content */
  rail?: ReactNode;
  /** Main page content */
  children: ReactNode;
  /** Additional class for the container */
  className?: string;
};

/**
 * PageShell - Unified layout wrapper for all authenticated pages
 *
 * Features:
 * - Full-width app-like feel on desktop (max-w-7xl)
 * - 2-column layout at lg+ with main content + context rail
 * - Rail auto-collapses if no content provided
 * - Consistent spacing and responsive behavior
 */
export default function PageShell({
  title,
  subtitle,
  rail,
  children,
  className = "",
}: PageShellProps) {
  const hasRail = Boolean(rail);

  return (
    <div className={`page-shell ${className}`}>
      {/* Page Header */}
      {(title || subtitle) && (
        <header className="page-shell-header">
          {title && <h1 className="page-shell-title">{title}</h1>}
          {subtitle && <p className="page-shell-subtitle">{subtitle}</p>}
        </header>
      )}

      {/* Main Grid - Rail only renders if content exists */}
      <div className={`page-shell-grid ${hasRail ? "page-shell-grid--with-rail" : ""}`}>
        <main className="page-shell-main">{children}</main>

        {hasRail && (
          <aside className="page-shell-rail">
            <div className="page-shell-rail-content">{rail}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
