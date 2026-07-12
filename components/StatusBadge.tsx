"use client";

import { Badge } from "@/components/ui/badge";
import { getStatusColor } from "@/lib/helpers";

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export const StatusBadge = ({ status, label, className = "" }: StatusBadgeProps) => {
  const displayLabel = label || status.replace(/_/g, " ").toUpperCase();
  const colorClass = getStatusColor(status);

  return (
    <Badge className={`${colorClass} ${className}`}>
      {displayLabel}
    </Badge>
  );
};
