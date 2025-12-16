"use client";

import { Monitor, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  title: string;
  version?: string;
}

export function Header({ title, version = "v2.4" }: HeaderProps) {
  return (
    <header className="h-16 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-[#1a1f2e] flex items-center justify-between px-6 transition-colors duration-300">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/10">
          {version}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* User Avatars */}
        <div className="flex -space-x-3">
          <Avatar className="w-9 h-9 border-2 border-white dark:border-[#1a1f2e] ring-2 ring-gray-100 dark:ring-white/5">
            <AvatarFallback className="bg-green-500 text-white text-xs font-medium">AM</AvatarFallback>
          </Avatar>
          <Avatar className="w-9 h-9 border-2 border-white dark:border-[#1a1f2e] ring-2 ring-gray-100 dark:ring-white/5">
            <AvatarFallback className="bg-amber-500 text-white text-xs font-medium">SK</AvatarFallback>
          </Avatar>
          <Avatar className="w-9 h-9 border-2 border-white dark:border-[#1a1f2e] ring-2 ring-gray-100 dark:ring-white/5 bg-gray-100 dark:bg-white/5">
            <AvatarFallback className="bg-gray-100 dark:bg-transparent text-gray-600 dark:text-gray-400 text-xs font-medium border border-gray-200 dark:border-transparent">+</AvatarFallback>
          </Avatar>
        </div>

        <div className="h-8 w-px bg-gray-200 dark:bg-white/10 mx-2" />

        {/* Share Button */}
        <Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5">
          <Share2 className="w-5 h-5" />
        </Button>

        {/* TV Mode Button */}
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm dark:shadow-none transition-all">
          <Monitor className="w-4 h-4" />
          <span className="hidden sm:inline">TV Mode</span>
        </Button>
      </div>
    </header>
  );
}