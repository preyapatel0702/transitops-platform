"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  className?: string;
  onClick?: () => void;
}

export const KPICard = ({
  title,
  value,
  icon: Icon,
  trend,
  description,
  className = "",
  onClick,
}: KPICardProps) => {
  return (
    <Card
      className={`hover-lift cursor-pointer hover:shadow-medium ${className}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground font-sans">{title}</CardTitle>
        <span className="gradient-brand flex h-8 w-8 items-center justify-center rounded-lg text-primary-foreground shrink-0">
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-display font-bold tracking-tight">{value}</div>
        <div className="flex items-center gap-2 pt-1">
          {trend && (
            <span
              className={`text-xs font-medium ${
                trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
          )}
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
        </div>
      </CardContent>
    </Card>
  );
};
