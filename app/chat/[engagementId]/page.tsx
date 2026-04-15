"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { use } from "react";
import { ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Types
interface Message {
  id: string;
  role: "agent" | "supplier";
  content: string;
  timestamp: Date;
}

interface FieldStatus {
  id: string;
  label: string;
  collected: boolean;
}

type FieldKey = "fibre_composition" | "dye_process" | "recycled_content";

// Field definitions
const FIELDS: FieldStatus[] = [
  { id: "fibre_composition", label: "Fibre composition", collected: false },
  { id: "dye_process", label: "Dye process", collected: false },
  { id: "recycled_content", label: "Recycled content %", collected: false },
];

// Keyword matching for each field
const FIELD_KEYWORDS: Record<FieldKey, string[]> = {
  fibre_composition: ["cotton", "organic", "polyester", "elastane", "nylon", "wool", "silk", "%"],
  dye_process: ["dye", "indigo", "natural", "synthetic", "low-impact", "reactive", "pigment"],
  recycled_content: ["recycled", "virgin", "post-consumer", "pre-consumer", "upcycled"],
};

// Agent responses
const AGENT_RESPONSES = {
  initial:
    "Hi! I'm helping Acme Apparel prepare a Digital Product Passport for the Organic Cotton Crew Sock. They've shared most of the data with me — I just need a few details from you to finish it off. Sound good?",
  fibre_composition_ask:
    "Great! Let's start with the fibre composition. Could you tell me the breakdown of materials used in this product? Even a rough percentage split would be helpful.",
  fibre_composition_collected: (content: string) => {
    const hasPercentages = content.includes("%") || /\d+/.test(content);
    if (hasPercentages) {
      return "Got it — thanks for that breakdown. Quick one on the dyeing — what process does the cotton go through? Anything natural, low-impact, or standard reactive dyes?";
    }
    return "Got it. Quick one on the dyeing — what process does the cotton go through? Anything natural, low-impact, or standard reactive dyes?";
  },
  fibre_composition_clarify:
    "Could you give me the breakdown by percentage? Even a rough split like '80% cotton, 20% polyester' is fine.",
  dye_process_collected:
    "Perfect, low-impact dyes noted. Last question — what percentage of the materials are recycled content, if any?",
  dye_process_clarify:
    "I just need to know about the dye process used. Is it natural dyes, low-impact, reactive, or another method?",
  recycled_content_collected:
    "Perfect — that's everything I need. I'll hand this back to Acme Apparel for review. Thanks for your time!",
  recycled_content_clarify:
    "Almost done! I just need to know the recycled content percentage. Is any of the material recycled, or is it all virgin material?",
  greeting_response:
    "Great! Let's start with the fibre composition. Could you tell me the breakdown of materials used in this product? Even a rough percentage split would be helpful.",
};

// Check if message matches field keywords
function matchesField(message: string, field: FieldKey): boolean {
  const lowerMessage = message.toLowerCase();
  const keywords = FIELD_KEYWORDS[field];
  
  // Check for percentage pattern
  if (field === "fibre_composition" || field === "recycled_content") {
    if (/\d+\s*%/.test(message) || /\d+\s*percent/i.test(message)) {
      return true;
    }
  }
  
  return keywords.some((keyword) => lowerMessage.includes(keyword.toLowerCase()));
}

// Check if it's a simple greeting/affirmation
function isGreeting(message: string): boolean {
  const greetings = [
    "yes", "yeah", "yep", "sure", "ok", "okay", "sounds good", 
    "hi", "hello", "hey", "great", "perfect", "let's go", "ready",
    "go ahead", "fire away", "shoot"
  ];
  const lower = message.toLowerCase().trim();
  return greetings.some((g) => lower === g || lower.startsWith(g + " ") || lower.startsWith(g + "!") || lower.startsWith(g + "."));
}

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// Format timestamp
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Check if timestamps should be shown (2+ minutes apart)
function shouldShowTimestamp(current: Date, previous: Date | null): boolean {
  if (!previous) return true;
  return current.getTime() - previous.getTime() >= 2 * 60 * 1000;
}

// Header Component
function HeaderCard({
  engagementId,
  fields,
}: {
  engagementId: string;
  fields: FieldStatus[];
}) {
  return (
    <Card className="rounded-2xl border-0 bg-[#F5F6FC] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-extrabold tracking-wide text-foreground">
          SCOUT
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {engagementId.substring(0, 8)}
        </span>
      </div>
      
      <div className="mt-3">
        <h1 className="text-base font-semibold leading-tight text-foreground">
          Helping Acme Apparel complete a Digital Product Passport
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For: Organic Cotton Crew Sock — SKU OCS-2026-01
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              field.collected
                ? "bg-green-50 text-green-700"
                : "bg-secondary text-muted-foreground"
            )}
          >
            <span className="text-sm">{field.collected ? "✅" : "⚪"}</span>
            <span>{field.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  showTimestamp,
}: {
  message: Message;
  showTimestamp: boolean;
}) {
  const isAgent = message.role === "agent";

  return (
    <div
      className={cn("flex flex-col", isAgent ? "items-start" : "items-end")}
    >
      <div
        className={cn(
          "max-w-[80%] px-4 py-2.5 text-sm leading-relaxed",
          isAgent
            ? "rounded-2xl rounded-bl-lg bg-secondary text-foreground"
            : "rounded-2xl rounded-br-lg bg-[#0A84FF] text-white"
        )}
      >
        {message.content}
      </div>
      {showTimestamp && (
        <span className="mt-1 px-1 text-xs text-muted-foreground">
          {formatTime(message.timestamp)}
        </span>
      )}
    </div>
  );
}

// Typing Indicator Component
function TypingIndicator() {
  return (
    <div className="flex items-start">
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-lg bg-secondary px-4 py-3">
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
      </div>
    </div>
  );
}

// Input Bar Component
function InputBar({
  onSend,
  disabled,
}: {
  onSend: (message: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
    }
  };

  useEffect(() => {
    // Focus input on mount for mobile keyboard
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-border bg-background p-3 safe-area-bottom"
    >
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your reply..."
        disabled={disabled}
        className="flex-1 rounded-full border-secondary bg-secondary px-4 focus-visible:ring-1"
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="h-10 w-10 shrink-0 rounded-full bg-[#0A84FF] hover:bg-[#0A84FF]/90 disabled:opacity-50"
      >
        <ArrowUp className="h-5 w-5" />
      </Button>
    </form>
  );
}

// Main Chat Page Component
export default function ChatPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { engagementId } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const [fields, setFields] = useState<FieldStatus[]>(FIELDS);
  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [hasReceivedFirstResponse, setHasReceivedFirstResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Add agent message with typing delay
  const addAgentMessage = useCallback((content: string, delay = 1200 + Math.random() * 600) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "agent",
          content,
          timestamp: new Date(),
        },
      ]);
    }, delay);
  }, []);

  // Initial agent message
  useEffect(() => {
    if (messages.length === 0) {
      const timer = setTimeout(() => {
        addAgentMessage(AGENT_RESPONSES.initial, 800);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [messages.length, addAgentMessage]);

  // Handle supplier message
  const handleSendMessage = useCallback(
    (content: string) => {
      // Add supplier message
      const supplierMessage: Message = {
        id: generateId(),
        role: "supplier",
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, supplierMessage]);

      // Process response
      const fieldOrder: FieldKey[] = ["fibre_composition", "dye_process", "recycled_content"];
      const currentField = fieldOrder[currentFieldIndex];

      // Check if this is first response (greeting)
      if (!hasReceivedFirstResponse) {
        setHasReceivedFirstResponse(true);
        if (isGreeting(content)) {
          addAgentMessage(AGENT_RESPONSES.greeting_response);
          return;
        }
      }

      // Check if all fields are collected
      if (currentFieldIndex >= fieldOrder.length) {
        return;
      }

      // Check if message matches current field
      if (matchesField(content, currentField)) {
        // Mark field as collected
        setFields((prev) =>
          prev.map((f) =>
            f.id === currentField ? { ...f, collected: true } : f
          )
        );

        // Move to next field
        const nextIndex = currentFieldIndex + 1;
        setCurrentFieldIndex(nextIndex);

        // Generate response
        if (currentField === "fibre_composition") {
          addAgentMessage(AGENT_RESPONSES.fibre_composition_collected(content));
        } else if (currentField === "dye_process") {
          addAgentMessage(AGENT_RESPONSES.dye_process_collected);
        } else if (currentField === "recycled_content") {
          addAgentMessage(AGENT_RESPONSES.recycled_content_collected);
          setIsComplete(true);
        }
      } else {
        // Clarifying question
        const clarifyKey = `${currentField}_clarify` as keyof typeof AGENT_RESPONSES;
        const response = AGENT_RESPONSES[clarifyKey];
        if (typeof response === "string") {
          addAgentMessage(response);
        }
      }
    },
    [currentFieldIndex, hasReceivedFirstResponse, addAgentMessage]
  );

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 p-4 pb-0">
        <HeaderCard engagementId={engagementId || "loading..."} fields={fields} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-3">
          {messages.map((message, index) => {
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showTimestamp = shouldShowTimestamp(
              message.timestamp,
              prevMessage?.timestamp ?? null
            );
            return (
              <MessageBubble
                key={message.id}
                message={message}
                showTimestamp={showTimestamp}
              />
            );
          })}
          {isTyping && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0">
        <InputBar onSend={handleSendMessage} disabled={isTyping || isComplete} />
      </div>
    </main>
  );
}
