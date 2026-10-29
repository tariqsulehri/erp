'use client';

import type { CSSProperties, ReactNode } from 'react';

interface DashboardPanelProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  bodyStyle?: CSSProperties;
  className?: string;
}

export function DashboardPanel({
  title,
  children,
  actions,
  bodyStyle,
  className = '',
}: DashboardPanelProps) {
  return (
    <section className={`panel panel-banded ${className}`.trim()}>
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="panel-title">{title}</h2>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
      <div className="panel-body" style={bodyStyle}>
        {children}
      </div>
    </section>
  );
}

