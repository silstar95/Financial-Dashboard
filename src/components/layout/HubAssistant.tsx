"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface HubAssistantProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function HubAssistant({ onClose, showCloseButton = false }: HubAssistantProps) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    // TODO: Implement AI chat
    console.log("Sending:", message);
    setMessage("");
  };

  return (
    <div className="w-full border-r bg-white dark:bg-[#1a1f2e] border-gray-200 dark:border-white/10 flex flex-col h-full transition-colors duration-300">
      {/* Header */}
      <div className="h-16 px-4 sm:px-6 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Close button - only on mobile */}
          {showCloseButton && onClose && (
            <button 
              onClick={onClose}
              className="p-2 -ml-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
          )}
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Hub Assistant</span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-indigo-500 text-white text-xs">H</AvatarFallback>
          </Avatar>
          <div className="bg-gray-100 dark:bg-white/5 rounded-lg p-3 text-sm text-gray-900 dark:text-gray-100">
            <p>Welcome back, Alex. I&apos;ve connected to your Stripe and Google Analytics accounts.</p>
            <p className="mt-2">What would you like to build today?</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 pb-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="text-xs border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
            Add Revenue
          </Button>
          <Button variant="outline" size="sm" className="text-xs border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
            Connect Stripe
          </Button>
          <Button variant="outline" size="sm" className="text-xs border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
            Share Hub
          </Button>
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-white/10">
        <div className="flex gap-2">
          <Input
            placeholder="Ask to create a chart..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
          />
          <Button size="icon" onClick={handleSend} className="bg-indigo-500 hover:bg-indigo-600">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}