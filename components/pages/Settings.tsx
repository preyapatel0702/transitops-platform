"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState({
    companyName: "TransitOps Fleet",
    email: user?.email || "",
    phone: "+1-555-0000",
    timezone: "UTC",
    language: "English",
    notifications: true,
    emailAlerts: true,
    maintenanceReminders: true,
    licenseExpiryAlerts: true,
  });

  const handleLogout = async () => {
    // Await signOut so the server-side session cookie is cleared before
    // we navigate; next-auth's signOut() already redirects to /login via
    // its callbackUrl, so no manual window.location redirect is needed.
    await logout();
  };

  const handleSave = () => {
    toast.success("Settings saved successfully");
  };

  return (
    <DashboardLayout onLogout={handleLogout} userName={user?.name || "User"} userRole={user?.role}>
      <div className="space-y-8 max-w-2xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and application settings</p>
        </div>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Update your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company Name</Label>
              <Input
                id="company"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              />
            </div>
            <Button onClick={handleSave}>Save Changes</Button>
          </CardContent>
        </Card>

        {/* Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>Preferences</CardTitle>
            <CardDescription>Customize your application experience</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Toggle dark theme</p>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option>UTC</option>
                <option>EST</option>
                <option>CST</option>
                <option>MST</option>
                <option>PST</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                value={settings.language}
                onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
                <option>German</option>
              </select>
            </div>
            <Button onClick={handleSave}>Save Preferences</Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Manage notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive in-app notifications</p>
              </div>
              <Switch
                checked={settings.notifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notifications: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Alerts</Label>
                <p className="text-sm text-muted-foreground">Receive email notifications</p>
              </div>
              <Switch
                checked={settings.emailAlerts}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailAlerts: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Maintenance Reminders</Label>
                <p className="text-sm text-muted-foreground">Get reminders for scheduled maintenance</p>
              </div>
              <Switch
                checked={settings.maintenanceReminders}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, maintenanceReminders: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>License Expiry Alerts</Label>
                <p className="text-sm text-muted-foreground">Alert when driver licenses are expiring</p>
              </div>
              <Switch
                checked={settings.licenseExpiryAlerts}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, licenseExpiryAlerts: checked })
                }
              />
            </div>
            <Button onClick={handleSave}>Save Notification Settings</Button>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Logging out will end your current session. You will need to log in again to access the application.
              </p>
              <Button variant="destructive" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
