"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Truck,
  Users,
  Navigation,
  Wrench,
  Fuel,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: "Vehicles", href: "/vehicles", icon: <Truck className="h-5 w-5" /> },
  { label: "Drivers", href: "/drivers", icon: <Users className="h-5 w-5" /> },
  { label: "Trips", href: "/trips", icon: <Navigation className="h-5 w-5" /> },
  { label: "Maintenance", href: "/maintenance", icon: <Wrench className="h-5 w-5" /> },
  { label: "Fuel Logs", href: "/fuel-logs", icon: <Fuel className="h-5 w-5" /> },
  { label: "Expenses", href: "/expenses", icon: <DollarSign className="h-5 w-5" /> },
  { label: "Reports", href: "/reports", icon: <BarChart3 className="h-5 w-5" /> },
];

interface SidebarProps {
  onLogout: () => void;
  userName?: string;
}

export const Sidebar = ({ onLogout, userName = "User" }: SidebarProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const location = usePathname();

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-40 lg:hidden glass-panel shadow-medium rounded-lg"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-64 bg-sidebar/95 backdrop-blur-xl border-r border-sidebar-border transition-transform duration-300 z-30",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="gradient-brand shadow-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-display font-bold text-sm">
                TO
              </div>
              <div>
                <h1 className="text-lg font-display font-bold text-sidebar-foreground leading-tight">TransitOps</h1>
                <p className="text-xs text-muted-foreground">Fleet Management</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.href}
                onClick={() => {
                  window.location.href = item.href;
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 text-left",
                  location === item.href
                    ? "gradient-brand text-primary-foreground shadow-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-0.5"
                )}
              >
                {item.icon}
                <span className="font-medium text-sm">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="border-t border-sidebar-border p-4 space-y-2">
            <button
              onClick={() => {
                window.location.href = "/settings";
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-200 text-left"
            >
              <Settings className="h-5 w-5" />
              <span className="font-medium text-sm">Settings</span>
            </button>
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={onLogout}
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </Button>
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-4 py-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Logged in as <span className="font-medium text-sidebar-foreground">{userName}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};
