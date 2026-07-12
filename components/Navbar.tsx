"use client";

import { Bell, Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavbarProps {
  userName?: string;
  userRole?: string;
  onProfileClick?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  FLEET_MANAGER: "Fleet Manager",
  SAFETY_OFFICER: "Safety Officer",
  FINANCIAL_ANALYST: "Financial Analyst",
  DRIVER: "Driver",
};

export const Navbar = ({ userName = "User", userRole, onProfileClick }: NavbarProps) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 w-full border-b border-border/70 glass-panel supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6 lg:ml-64">
        {/* Left side - empty for now */}
        <div />

        {/* Right side - actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative rounded-full">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-background" />
          </Button>

          {/* Theme Toggle */}
          <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <span className="gradient-brand flex h-8 w-8 items-center justify-center rounded-full text-primary-foreground">
                  <User className="h-4 w-4" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{userName}</span>
                  {userRole && (
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[userRole] ?? userRole}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onProfileClick}>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Help</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
