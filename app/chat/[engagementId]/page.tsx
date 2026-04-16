"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { use } from "react";
import { ArrowUp, Paperclip, FileText, ImageIcon, File, X, CheckCircle2, Circle } from "lucide-react";
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
  data?: string; // base64-encoded file content
}

interface Message {
  id: string;
  role: "agent" | "supplier";
  content: string;
  timestamp: Date;
  attachments?: FileAttachment[];
}

interface FieldView {
  name: string;
  label: string;
  required: boolean;
  value: string | null;
  source: "enterprise" | "supplier" | null;
}

interface EngagementData {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  enterpriseName: string;
  supplierName: string;
  status: "gathering" | "complete" | "minted";
  missingFields: Array<{ name: string; label: string }>;
  filledBySupplier: Record<string, string>;
  messages: Array<{ role: "agent" | "supplier"; content: string; timestamp: string }>;
  fields: FieldView[];
}

// Helpers
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type === "application/pdf") return FileText;
  return File;
}

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "text/plain",
].join(",");

function shouldShowTimestamp(current: Date, previous: Date | null): boolean {
  if (!previous) return true;
  return current.getTime() - previous.getTime() >= 2 * 60 * 1000;
}

// Header Component
function HeaderCard({
  engagementId,
  enterpriseName,
  productName,
  sku,
  fields,
  filledBySupplier,
  status,
}: {
  engagementId: string;
  enterpriseName: string;
  productName: string;
  sku: string;
  fields: Array<{ name: string; label: string }>;
  filledBySupplier: Record<string, string>;
  status: string;
}) {
  return (
    <Card className="rounded-2xl border-0 bg-[#F5F6FC] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-extrabold tracking-wide text-foreground">
          SCOUT
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {engagementId}
        </span>
      </div>

      <div className="mt-3">
        <h1 className="text-base font-semibold leading-tight text-foreground">
          Helping {enterpriseName} complete a Digital Product Passport
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          For: {productName} — SKU {sku}
        </p>
      </div>

      {status === "complete" && (
        <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
          All fields collected — passport data complete
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {fields.map((field) => {
          const collected = !!filledBySupplier[field.name];
          return (
            <div
              key={field.name}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                collected
                  ? "bg-green-50 text-green-700"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {collected ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-3.5 w-3.5" />
              )}
              <span>{field.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// File Attachment Chip
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
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl p-2",
        isAgent ? "bg-background/60" : "bg-white/15"
      )}
    >
      {isImage ? (
        <img
          src={attachment.url}
          alt={attachment.name}
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
    </div>
  );
}

// Message Bubble
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
    <div className={cn("flex flex-col", isAgent ? "items-start" : "items-end")}>
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

// Typing Indicator
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
        <img src={file.url} alt={file.name} className="h-10 w-10 rounded-lg object-cover" />
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

// Input Bar
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: FileAttachment[] = await Promise.all(
      Array.from(files).map(async (file) => {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]); // strip data:...;base64, prefix
          };
          reader.readAsDataURL(file);
        });
        return {
          id: generateId(),
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          url: URL.createObjectURL(file),
          data: base64,
        };
      })
    );
    setStagedFiles((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) URL.revokeObjectURL(file.url);
      return prev.filter((f) => f.id !== id);
    });
  };

  useEffect(() => {
    if (!disabled && inputRef.current) inputRef.current.focus();
  }, [disabled]);

  const hasContent = value.trim() || stagedFiles.length > 0;

  return (
    <div className="border-t border-border bg-background safe-area-bottom">
      {stagedFiles.length > 0 && (
        <div className="flex flex-col gap-2 border-b border-border px-3 py-2">
          {stagedFiles.map((file) => (
            <StagedFile key={file.id} file={file} onRemove={removeStagedFile} />
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          multiple
          onChange={handleFileSelect}
          className="sr-only"
          id="file-upload"
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
          placeholder={disabled ? "All fields collected" : "Type your reply..."}
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

// Main Chat Page
export default function ChatPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { engagementId } = use(params);
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Load engagement on mount
  useEffect(() => {
    fetch(`/api/chat/${engagementId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load engagement");
        return res.json();
      })
      .then((data: EngagementData) => {
        setEngagement(data);
        setMessages(
          data.messages.map((m) => ({
            id: generateId(),
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
          }))
        );
      })
      .catch((err) => setError(err.message));
  }, [engagementId]);

  // Handle supplier sending a message
  const handleSendMessage = useCallback(
    async (content: string, attachments?: FileAttachment[]) => {
      if (!engagement) return;

      // Append supplier message locally
      const supplierMsg: Message = {
        id: generateId(),
        role: "supplier",
        content,
        timestamp: new Date(),
        attachments,
      };
      setMessages((prev) => [...prev, supplierMsg]);
      setIsTyping(true);

      try {
        const payload: Record<string, unknown> = { message: content };
        if (attachments?.length) {
          payload.files = attachments.map((a) => ({
            name: a.name,
            type: a.type,
            data: a.data,
          }));
        }
        const res = await fetch(`/api/chat/${engagementId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Failed to send message");

        const data = await res.json();

        // Append agent reply
        const agentMsg: Message = {
          id: generateId(),
          role: "agent",
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, agentMsg]);

        // Update engagement state
        setEngagement((prev) =>
          prev
            ? {
                ...prev,
                status: data.status,
                filledBySupplier: {
                  ...prev.filledBySupplier,
                  ...data.fieldUpdates,
                },
                fields: data.fields,
              }
            : prev
        );
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: generateId(),
            role: "agent",
            content: "Sorry, something went wrong. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [engagement, engagementId]
  );

  if (error) {
    return (
      <main className="flex h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!engagement) {
    return (
      <main className="flex h-dvh items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
        </div>
      </main>
    );
  }

  const isComplete = engagement.status === "complete";

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 p-4 pb-0">
        <HeaderCard
          engagementId={engagement.id}
          enterpriseName={engagement.enterpriseName}
          productName={engagement.productName}
          sku={engagement.sku}
          fields={engagement.missingFields}
          filledBySupplier={engagement.filledBySupplier}
          status={engagement.status}
        />
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
