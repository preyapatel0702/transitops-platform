"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

interface DashboardLayoutProps {
  children: ReactNode;
  onLogout: () => void;
  userName?: string;
  userRole?: string;
}

export const DashboardLayout = ({
  children,
  onLogout,
  userName = "User",
  userRole,
}: DashboardLayoutProps) => {
  return (
    <div className="min-h-screen bg-mesh-subtle">
      <Sidebar onLogout={onLogout} userName={userName} />
      <div className="lg:ml-64">
        <Navbar userName={userName} userRole={userRole} />
        <main className="p-6 lg:p-8 max-w-[1600px]">{children}</main>
      </div>
    </div>
  );
};
