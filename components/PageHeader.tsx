"use client";

import React from "react";

export interface PageHeaderStat {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  stats?: PageHeaderStat[];
  actions?: React.ReactNode;
}

/** Match-day style page header: serif display title, mono tabular stat readout. */
export function PageHeader({ eyebrow, title, subtitle, stats, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap justify-between items-end gap-4">
      <div>
        {eyebrow && <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-1">{eyebrow}</p>}
        <h1 className="font-display text-4xl tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {(stats?.length || actions) && (
        <div className="flex items-end gap-4">
          {stats && stats.length > 0 && (
            <div className="flex items-end gap-5 rounded-lg border border-border-strong bg-surface px-5 py-3">
              {stats.map((stat, i) => (
                <div key={stat.label} className={i === 0 ? "" : "pl-5 border-l border-border"}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  <p
                    className={`font-mono font-semibold tabular-nums leading-none mt-0.5 ${
                      stat.emphasis ? "text-2xl text-accent" : "text-lg"
                    }`}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}
