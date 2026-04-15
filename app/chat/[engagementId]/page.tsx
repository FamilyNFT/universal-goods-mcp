"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { use } from "react";
import { ArrowUp, Paperclip, FileText, ImageIcon, File, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Types
interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface Message {
  id: string;
  role: "agent" | "supplier";
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
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
  file_received: (count: number) =>
    count === 1
      ? "Thanks, I've received the file! Let me take note of that. Could you also confirm the details in the chat so I can log them properly?"
      : `Thanks, I've received those ${count} files! Let me take note of them. Could you also confirm the key details in the chat so I can log them properly?`,
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

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Get file icon based on type
function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  return File;
}

// Accepted file types
const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
].join(",");

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

// File Attachment Chip (in message bubbles)
function AttachmentChip({
  attachment,
  isAgent,
}: {
  attachment: FileAttachment;
  isAgent: boolean;
}) {
  const Icon = getFileIcon(attachment.type);
  const isImage = attachment.type.startsWith("image/");

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-xl p-2 transition-opacity hover:opacity-80",
        isAgent ? "bg-background/60" : "bg-white/15"
      )}
    >
      {isImage ? (
        <img
          src={attachment.url}
          alt={attachment.name}
          crossOrigin="anonymous"
          className="h-12 w-12 rounded-lg object-cover"
        />
      ) : (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            isAgent ? "bg-background" : "bg-white/20"
          )}
        >
          <Icon className={cn("h-5 w-5", isAgent ? "text-muted-foreground" : "text-white")} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-xs font-medium", isAgent ? "text-foreground" : "text-white")}>
          {attachment.name}
        </p>
        <p className={cn("text-[10px]", isAgent ? "text-muted-foreground" : "text-white/70")}>
          {formatFileSize(attachment.size)}
        </p>
      </div>
    </a>
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
  const hasAttachments = message.attachments && message.attachments.length > 0;

  return (
    <div
      className={cn("flex flex-col", isAgent ? "items-start" : "items-end")}
    >
      <div
        className={cn(
          "max-w-[80%] text-sm leading-relaxed",
          isAgent
            ? "rounded-2xl rounded-bl-lg bg-secondary text-foreground"
            : "rounded-2xl rounded-br-lg bg-[#0A84FF] text-white",
          hasAttachments ? "px-2 pb-2.5 pt-2" : "px-4 py-2.5"
        )}
      >
        {hasAttachments && (
          <div className="mb-2 flex flex-col gap-1.5">
            {message.attachments!.map((att) => (
              <AttachmentChip key={att.id} attachment={att} isAgent={isAgent} />
            ))}
          </div>
        )}
        {message.content && (
          <p className={hasAttachments ? "px-2" : ""}>{message.content}</p>
        )}
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

// Staged File Preview
function StagedFile({
  file,
  onRemove,
}: {
  file: FileAttachment;
  onRemove: (id: string) => void;
}) {
  const Icon = getFileIcon(file.type);
  const isImage = file.type.startsWith("image/");

  return (
    <div className="relative flex items-center gap-2 rounded-xl bg-secondary p-2">
      {isImage ? (
        <img
          src={file.url}
          alt={file.name}
          crossOrigin="anonymous"
          className="h-10 w-10 rounded-lg object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">{file.name}</p>
        <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground transition-colors hover:bg-muted-foreground/30"
        aria-label={`Remove ${file.name}`}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

// Input Bar Component
function InputBar({
  onSend,
  disabled,
}: {
  onSend: (message: string, attachments?: FileAttachment[]) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const [stagedFiles, setStagedFiles] = useState<FileAttachment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((value.trim() || stagedFiles.length > 0) && !disabled) {
      onSend(value.trim(), stagedFiles.length > 0 ? stagedFiles : undefined);
      setValue("");
      setStagedFiles([]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: FileAttachment[] = Array.from(files).map((file) => ({
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file),
    }));

    setStagedFiles((prev) => [...prev, ...newAttachments]);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) URL.revokeObjectURL(file.url);
      return prev.filter((f) => f.id !== id);
    });
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const hasContent = value.trim() || stagedFiles.length > 0;

  return (
    <div className="border-t border-border bg-background safe-area-bottom">
      {/* Staged files */}
      {stagedFiles.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
          {stagedFiles.map((file) => (
            <StagedFile key={file.id} file={file} onRemove={removeStagedFile} />
          ))}
        </div>
      )}

      {/* Input row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={handleFileSelect}
          className="sr-only"
          id="file-upload"
          aria-label="Attach files"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach file"
          className="h-10 w-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
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
          disabled={disabled || !hasContent}
          aria-label="Send message"
          className="h-10 w-10 shrink-0 rounded-full bg-[#0A84FF] hover:bg-[#0A84FF]/90 disabled:opacity-50"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      </form>
    </div>
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
    (content: string, attachments?: FileAttachment[]) => {
      // Add supplier message
      const supplierMessage: Message = {
        id: generateId(),
        role: "supplier",
        content,
        timestamp: new Date(),
        attachments,
      };
      setMessages((prev) => [...prev, supplierMessage]);

      // Process response
      const fieldOrder: FieldKey[] = ["fibre_composition", "dye_process", "recycled_content"];
      const currentField = fieldOrder[currentFieldIndex];

      // If only files sent with no text, acknowledge them
      if (!content && attachments && attachments.length > 0) {
        if (!hasReceivedFirstResponse) setHasReceivedFirstResponse(true);
        addAgentMessage(AGENT_RESPONSES.file_received(attachments.length));
        return;
      }

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
