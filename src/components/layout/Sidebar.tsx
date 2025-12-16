"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Bell,
  Building2,
  Settings,
  Monitor,
  Sun,
  Moon,
  LogOut,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { label: "PLATFORM", items: [
    { name: "The Hub", href: "/dashboard", icon: LayoutDashboard },
    { name: "Data Sources", href: "/data-sources", icon: Database },
    { name: "Alerts", href: "/alerts", icon: Bell },
    { name: "Companies", href: "/companies", icon: Building2 },
  ]},
  { label: "SYSTEM", items: [
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "TV Mode", href: "/tv", icon: Monitor },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, signOut, loading } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // or a skeleton loader
  }

  const isDark = resolvedTheme === "dark";

  // Get user display name and initials
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const handleLogout = async () => {
    setSigningOut(true);
    setShowLogout(false);
    
    try {
      // Call server-side logout to clear cookies
      await fetch("/auth/signout", { method: "POST" });
      // Also sign out client-side
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
    // Force full page reload to /login to ensure all state is cleared
    window.location.href = "/login";
  };

  // Show full-page loading overlay when signing out
  if (signingOut) {
    return (
      <>
        {/* Full page overlay */}
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            <p className="text-white text-lg font-medium">Signing out...</p>
          </div>
        </div>
        {/* Keep sidebar visible behind overlay */}
        <aside className="w-full bg-white dark:bg-[#1a1f2e] border-r border-gray-200 dark:border-white/10 flex flex-col h-screen transition-colors duration-300" />
      </>
    );
  }

  return (
    <aside className="w-full bg-white dark:bg-[#1a1f2e] border-r border-gray-200 dark:border-white/10 flex flex-col h-screen transition-colors duration-300">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
          <div className="w-3 h-3 bg-white rounded-full" />
        </div>
        <span className="font-bold text-xl text-gray-900 dark:text-white">The Hub</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-8">
        {navItems.map((section) => (
          <div key={section.label}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">
              {section.label}
            </p>
            <ul className="space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500")} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Theme Toggle */}
      <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Theme</span>
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            {isDark ? (
              <Moon className="w-5 h-5 text-indigo-400" />
            ) : (
              <Sun className="w-5 h-5 text-orange-500" />
            )}
          </button>
        </div>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200 dark:border-white/10">
        <div className="relative">
          <div 
            onClick={() => setShowLogout(!showLogout)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <Avatar className="w-10 h-10 border border-gray-200 dark:border-white/10">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-indigo-600 text-white font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email || "Loading..."}</p>
            </div>
          </div>
          
          {/* Logout popup on click */}
          {showLogout && (
            <>
              {/* Backdrop to close popup when clicking outside */}
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowLogout(false)}
              />
              <div className="absolute bottom-full left-0 right-0 mb-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}