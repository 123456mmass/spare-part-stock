import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageTitleProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
};

/** Prototype-faithful page header: gold bar + title + description, optional action on the right. */
export function PageTitle({ title, description, action, className }: PageTitleProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="page-title">
        <span className="bar-g" aria-hidden />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
