"use client";

import React, { useState, useMemo } from "react";
import type { Message, Part, ToolPart, TextPart, ReasoningPart, FilePart, Permission } from "@opencode-ai/sdk";
import { Undo2, CheckCircle2, Eye, FileText, FilePenLine, Trash2, Terminal, Search, Globe, ListTodo, Play, Loader2, AlertCircle } from "lucide-react";
import { ShimmeringText } from "@/components/ui/shimmer-text";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Markdown } from "@/components/ui/markdown";
import { useRespondPermission } from "@/queries/chats";

type PermissionResponse = "once" | "always" | "reject";

const TOOLS: Record<string, { icon: React.ElementType; done: string; doing: string }> = {
  read: { icon: Eye, done: "Read", doing: "Reading..." },
  write: { icon: FileText, done: "Created", doing: "Creating..." },
  edit: { icon: FilePenLine, done: "Edited", doing: "Editing..." },
  delete: { icon: Trash2, done: "Deleted", doing: "Deleting..." },
  bash: { icon: Terminal, done: "Ran", doing: "Running..." },
  grep: { icon: Search, done: "Searched", doing: "Searching..." },
  glob: { icon: Search, done: "Searched", doing: "Searching..." },
  list: { icon: Search, done: "Listed", doing: "Listing..." },
  webfetch: { icon: Globe, done: "Fetched", doing: "Fetching..." },
  todowrite: { icon: ListTodo, done: "Todos", doing: "Updating..." },
  todoread: { icon: ListTodo, done: "Todos", doing: "Loading..." },
  dev: { icon: Play, done: "Started", doing: "Starting..." },
  devLogs: { icon: Terminal, done: "Logs", doing: "Loading..." },
};

function getTarget(part: ToolPart): string | undefined {
  if (part.state.status === "pending") return;
  const input = part.state.input as Record<string, unknown>;
  if (["read", "write", "edit"].includes(part.tool)) return String(input.filePath || "").split(/[/\\]/).pop();
  if (["bash", "dev"].includes(part.tool)) return String(input.command || "");
  if (part.tool === "grep") return String(input.pattern || "");
  if (part.tool === "glob") return String(input.pattern || "");
  if (part.tool === "list") return String(input.path || "/");
  if (part.tool === "webfetch") {
    try { return new URL(String(input.url)).hostname; }
    catch { return String(input.url); }
  }
}

function formatValue(val: unknown): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "string") return val;
  return JSON.stringify(val, null, 2);
}

type Turn = { user: Message; assistants: Message[] };

function groupTurns(messages: Message[]): Turn[] {
  const turns: Turn[] = [];
  let current: Turn | undefined;
  messages.forEach(m => {
    if (m.role === "user") {
      current = { user: m, assistants: [] };
      turns.push(current);
      return;
    }
    if (m.role === "assistant" && current) current.assistants.push(m);
  });
  return turns;
}

type TodoItem = { id?: string; content?: string; status?: string };

function getTodosFromToolPart(part: ToolPart): TodoItem[] {
  const input = part.state.status !== "pending" ? (part.state.input as Record<string, unknown>) : {};
  if (Array.isArray(input?.todos)) return input.todos as TodoItem[];
  if (part.state.status !== "completed") return [];
  try {
    const val = typeof part.state.output === "string" ? JSON.parse(part.state.output) : part.state.output;
    return Array.isArray(val) ? val as TodoItem[] : [];
  } catch {
    return [];
  }
}

function PermissionPrompt({ permission, onRespond, responding, error }: {
  permission: Permission;
  onRespond: (response: PermissionResponse) => void;
  responding: boolean;
  error?: string;
}) {
  return (
    <div className="rounded-lg border overflow-hidden bg-muted/30">
      <div className="flex items-center gap-2 px-3 h-8 border-b">
        <AlertCircle className="size-3 text-primary shrink-0" />
        <span className="text-xs font-medium">Permission required</span>
      </div>
      <div className="px-3 py-2 text-[11px] text-muted-foreground break-all">
        {permission.title}
      </div>
      <div className="flex items-stretch h-8 border-t bg-muted/40">
        <button
          onClick={() => onRespond("once")}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-1 text-xs text-primary font-medium bg-background hover:bg-muted disabled:opacity-50 transition-colors"
        >
          {responding && <Loader2 className="size-3 animate-spin" />}
          Allow
        </button>
        <button
          onClick={() => onRespond("always")}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs border-l bg-background hover:bg-muted disabled:opacity-50 transition-colors"
        >
          <span className="size-1.5 rounded-full bg-success" />
          Always Allow
        </button>
        <button
          onClick={() => onRespond("reject")}
          disabled={responding}
          className="flex-1 flex items-center justify-center text-xs text-muted-foreground border-l hover:bg-muted/50 disabled:opacity-50 transition-colors"
        >
          Reject
        </button>
      </div>
      {error && <div className="px-3 py-1.5 text-[11px] text-destructive border-t">{error}</div>}
    </div>
  );
}

function Tool({ part, permission, onRespondPermission, responding, respondError }: {
  part: ToolPart;
  permission?: Permission;
  onRespondPermission?: (permission: Permission, response: PermissionResponse) => void;
  responding?: boolean;
  respondError?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TOOLS[part.tool] || { icon: FileText, done: part.tool, doing: "Working..." };
  const Icon = cfg.icon;
  const target = getTarget(part);
  const running = part.state.status === "running" || part.state.status === "pending";

  const header = (() => {
    if (running) {
      return (
        <div className="flex items-center gap-1 sm:gap-1.5 py-0.5 sm:py-1 text-[11px] sm:text-sm text-muted-foreground flex-wrap min-w-0">
          <ShimmeringText text={cfg.doing} duration={0.4} className="text-[11px] sm:text-sm" />
          {target && <code className="px-1 py-0.5 bg-muted rounded text-[10px] sm:text-xs truncate max-w-24 sm:max-w-48">{target}</code>}
        </div>
      );
    }

    if (part.state.status === "error") {
      return (
        <div className="flex items-center gap-1 py-0.5 text-[11px] sm:text-xs text-muted-foreground/60">
          <Icon className="size-2.5 sm:size-3 shrink-0" />
          <span>Skipped {target || cfg.done}</span>
        </div>
      );
    }

    return (
      <div className="group flex items-center gap-1 py-0.5 sm:py-1 text-[11px] sm:text-sm text-muted-foreground flex-wrap min-w-0">
        <Icon className={`size-2.5 sm:size-3.5 shrink-0 ${expanded ? "text-foreground" : ""}`} />
        <span>{cfg.done}</span>
        {target && <code className="px-1 py-0.5 bg-muted rounded text-[10px] sm:text-xs truncate max-w-24 sm:max-w-48">{target}</code>}
        <span className={`text-[10px] transition-opacity ${expanded ? "opacity-60" : "opacity-0 group-hover:opacity-60"}`}>{expanded ? "▾" : "▸"}</span>
      </div>
    );
  })();

  return (
    <div className={permission ? "space-y-2" : undefined}>
      <button
        onClick={() => setExpanded(s => !s)}
        disabled={running}
        className={`w-full text-left ${running ? "" : "hover:text-foreground cursor-pointer"} transition-colors`}
      >
        {header}
      </button>

      {expanded && !running && (
        <div className="ml-3 sm:ml-4 pl-2 sm:pl-3 border-l-2 border-muted space-y-2 text-[11px] sm:text-xs">
          {part.state.status !== "pending" && (
            <div>
              <div className="text-muted-foreground/70 font-medium mb-1">Input</div>
              <pre className="p-2 rounded bg-muted/50 whitespace-pre-wrap wrap-break-word">{formatValue(part.state.input)}</pre>
            </div>
          )}
          {part.state.status === "completed" && (
            <div>
              <div className="text-muted-foreground/70 font-medium mb-1">Output</div>
              <pre className="p-2 rounded bg-muted/50 whitespace-pre-wrap wrap-break-word">{formatValue(part.state.output)}</pre>
            </div>
          )}
          {part.state.status === "error" && (
            <div>
              <div className="text-destructive/70 font-medium mb-1">Error</div>
              <pre className="p-2 rounded bg-destructive/10 whitespace-pre-wrap wrap-break-word text-destructive">{String(part.state.error)}</pre>
            </div>
          )}
        </div>
      )}

      {permission && onRespondPermission && (
        <PermissionPrompt
          permission={permission}
          onRespond={(response) => onRespondPermission(permission, response)}
          responding={responding === true}
          error={respondError}
        />
      )}
    </div>
  );
}

function Todos({ part }: { part: ToolPart }) {
  const loading = part.state.status === "running" || part.state.status === "pending";
  const todos = useMemo(() => getTodosFromToolPart(part), [part.state]);

  const done = todos.filter(t => t.status === "completed").length;

  return (
    <div className="my-1.5 sm:my-2 p-2 sm:p-3 rounded-xl bg-muted/50 border w-full min-w-0">
      <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm text-muted-foreground mb-1.5 sm:mb-2">
        <ListTodo className="size-3 sm:size-4 shrink-0" />
        <span className="font-medium">{done}/{todos.length} done</span>
        {loading && <Loader2 className="size-2.5 sm:size-3 animate-spin ml-1" />}
      </div>
      {todos.length > 0 ? (
        <div className="space-y-1 sm:space-y-1.5">
          {todos.map((t, i) => {
            const isDone = t.status === "completed";
            return (
              <div key={t.id || i} className={`flex items-start gap-1 sm:gap-2 text-[11px] sm:text-sm ${isDone ? "opacity-50" : ""}`}>
                <div className={`size-3 sm:size-4 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${isDone ? "bg-primary border-primary" : "border-muted-foreground/30"}`}>
                  {isDone && <CheckCircle2 className="size-1.5 sm:size-2.5 text-primary-foreground" />}
                </div>
                <span className={`wrap-break-word min-w-0 ${isDone ? "line-through text-muted-foreground" : ""}`}>{t.content}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] sm:text-xs text-muted-foreground">No tasks yet</p>
      )}
    </div>
  );
}

function Thinking({ text, streaming, open, toggle }: { text: string; streaming: boolean; open: boolean; toggle: () => void }) {
  return (
    <div className="my-1">
      <button onClick={toggle} className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-sm text-muted-foreground hover:text-foreground transition-colors">
        <span className={`font-medium ${open ? "text-foreground" : ""}`}>{streaming ? "Thinking..." : "Thoughts"}</span>
        {!streaming && <span className="text-[10px] opacity-60">{open ? "▾" : "▸"}</span>}
      </button>
      {open && (
        <div className="pl-2 sm:pl-5 pt-1 sm:pt-1.5 text-[11px] sm:text-sm text-muted-foreground border-l-2 border-muted ml-1 sm:ml-1.5 min-w-0">
          {text ? (
            <Markdown className="prose prose-sm max-w-none prose-muted **:text-[11px] sm:**:text-sm">{text}</Markdown>
          ) : streaming ? (
            <ShimmeringText text="Thinking..." duration={0.3} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function FileThumb({ file }: { file: FilePart }) {
  const isImage = file.mime?.startsWith("image/");
  return (
    <a href={file.url} target="_blank" rel="noreferrer" download={!isImage ? file.filename : undefined} className="block size-8 sm:size-10 rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity shrink-0">
      {isImage ? (
        <img src={file.url} alt={file.filename || "file"} className="size-full object-cover" />
      ) : (
        <div className="size-full flex items-center justify-center"><FileText className="size-3 sm:size-4 text-muted-foreground" /></div>
      )}
    </a>
  );
}

function ApiError({ error }: { error: { code?: string; data?: { code?: string; message?: string }; message?: string; name?: string } }) {
  const code = error?.code || error?.data?.code;
  const msg = error?.data?.message || error?.message || error?.name || "Request failed";
  const isContext = code === "context_length_exceeded" || msg.includes("context");

  return (
    <div className={`flex items-start gap-2 py-2 px-3 rounded-lg border text-xs sm:text-sm ${isContext ? "bg-warning/10 border-warning/20 text-warning" : "bg-muted/50 text-muted-foreground"}`}>
      <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
      <p className="min-w-0 break-all">{isContext ? "Context limit reached. Start a new session." : msg}</p>
    </div>
  );
}

export function AgentThread({ projectId, sessionId, messages, partsMap, permissions, onRevert, revertMessageId, reverting, revertingMessageId, isWorking }: {
  projectId?: string;
  sessionId: string;
  messages: Message[];
  partsMap: Record<string, Part[]>;
  permissions?: Permission[];
  onRevert?: (id: string) => void;
  revertMessageId?: string;
  reverting?: boolean;
  revertingMessageId?: string;
  isWorking?: boolean;
}) {
  const [openThoughts, setOpenThoughts] = useState<Record<string, boolean>>({});
  const [permissionErrors, setPermissionErrors] = useState<Record<string, string>>({});
  const respondPermission = useRespondPermission(projectId, sessionId);

  const visible = revertMessageId ? messages.filter(m => m.id < revertMessageId) : messages;
  const turns = useMemo(() => groupTurns(visible), [visible]);

  const permissionByCallId = useMemo(() => {
    const map = new Map<string, Permission>();
    (permissions ?? []).forEach(p => {
      if (p.callID) map.set(p.callID, p);
    });
    return map;
  }, [permissions]);

  const toolCallIds = useMemo(() => {
    const ids = new Set<string>();
    visible.forEach(m => {
      (partsMap[m.id] ?? []).forEach(p => {
        if (p.type !== "tool") return;
        const toolPart = p as ToolPart;
        if (toolPart.tool === "todoread") return;
        if (toolPart.callID) ids.add(toolPart.callID);
      });
    });
    return ids;
  }, [partsMap, visible]);

  const unmatchedPermissions = useMemo(() => {
    if (!permissions?.length) return [];
    return permissions.filter(p => !p.callID || !toolCallIds.has(p.callID));
  }, [permissions, toolCallIds]);

  const respondToPermission = (permission: Permission, response: PermissionResponse) => {
    if (!projectId) return;
    setPermissionErrors(s => {
      if (!s[permission.id]) return s;
      const { [permission.id]: _, ...rest } = s;
      return rest;
    });
    respondPermission.mutate(
      { permissionId: permission.id, response },
      {
        onError: (err) => {
          setPermissionErrors(s => ({
            ...s,
            [permission.id]: err instanceof Error ? err.message : String(err),
          }));
        },
      }
    );
  };

  const getText = (m: Message) => {
    const fromParts = partsMap[m.id]?.filter((p): p is TextPart => p.type === "text").map(p => p.text).join("\n") ?? "";
    const summary = m.summary;
    const fromSummary = summary && typeof summary === "object" ? (summary.body || summary.title || "") : "";
    const text = fromParts || fromSummary;
    if (m.role === "user") {
      return text.replace(/!\[[^\]]*\]\([^)]+\)\n*/g, "").trim();
    }
    return text;
  };

  const getFiles = (m: Message) => partsMap[m.id]?.filter((p): p is FilePart => p.type === "file") ?? [];

  const renderPart = (p: Part) => {
    if (p.type === "reasoning") {
      const text = (p as ReasoningPart).text?.replace("[REDACTED]", "").trim() || "";
      const streaming = !(p as ReasoningPart).time?.end;
      if (!text && !streaming) return null;
      return (
        <Thinking
          key={p.id}
          text={text}
          streaming={streaming}
          open={openThoughts[p.id] ?? streaming}
          toggle={() => setOpenThoughts(s => ({ ...s, [p.id]: !s[p.id] }))}
        />
      );
    }

    if (p.type === "tool") {
      const toolPart = p as ToolPart;
      const permission = toolPart.callID ? permissionByCallId.get(toolPart.callID) : undefined;
      if (toolPart.tool === "todoread") return null;
      if (toolPart.tool === "todowrite") {
        if (!permission) return <Todos key={p.id} part={toolPart} />;
        return (
          <div key={p.id} className="space-y-2">
            <Todos part={toolPart} />
            <PermissionPrompt
              permission={permission}
              onRespond={response => respondToPermission(permission, response)}
              responding={respondPermission.isPending && respondPermission.variables?.permissionId === permission.id}
              error={permissionErrors[permission.id]}
            />
          </div>
        );
      }
      return (
        <Tool
          key={p.id}
          part={toolPart}
          permission={permission}
          onRespondPermission={respondToPermission}
          responding={respondPermission.isPending && respondPermission.variables?.permissionId === permission?.id}
          respondError={permission ? permissionErrors[permission.id] : undefined}
        />
      );
    }

    if (p.type === "file") return <div key={p.id} className="flex gap-1 py-1"><FileThumb file={p as FilePart} /></div>;
    if (p.type === "step-start" || p.type === "step-finish" || p.type === "patch") return null;

    if (p.type === "text") {
      const content = (p as TextPart).text?.trim();
      if (!content) return null;
      return <Markdown key={p.id} className="[&_p]:text-[13px] [&_p]:sm:text-sm [&_li]:text-[13px] [&_li]:sm:text-sm">{content}</Markdown>;
    }

    return null;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {turns.map((turn, idx) => {
        const timeline = turn.assistants.flatMap(m => partsMap[m.id] || []);

        const text = getText(turn.user);
        const userFiles = getFiles(turn.user);
        const isLast = idx === turns.length - 1;
        const lastAssistant = turn.assistants[turn.assistants.length - 1];
        const working = isLast ? (isWorking ?? !!(lastAssistant && lastAssistant.role === "assistant" && !lastAssistant.time.completed)) : false;
        const showPlanning = isLast && !!working;

        return (
          <div key={turn.user.id} className="space-y-2 sm:space-y-3">
            <div className="flex flex-col items-end gap-1">
              {userFiles.length > 0 && (
                <div className="flex gap-1 flex-wrap justify-end">
                  {userFiles.map(fp => <FileThumb key={fp.id} file={fp} />)}
                </div>
              )}
              <div className="relative max-w-[90%] sm:max-w-[80%] md:max-w-[70%] rounded-xl bg-muted/50 border px-2.5 sm:px-3 py-2 overflow-hidden">
                <div className="whitespace-pre-wrap text-sm sm:text-[15px] pr-5 sm:pr-6 break-all">
                  {text || <span className="text-muted-foreground italic">Sending...</span>}
                </div>
                {onRevert && text && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 size-5 sm:size-6 text-muted-foreground/40 hover:text-muted-foreground" onClick={() => onRevert(turn.user.id)} disabled={reverting}>
                        {reverting && revertingMessageId === turn.user.id ? <Loader2 className="size-3 sm:size-3.5 animate-spin" /> : <Undo2 className="size-3 sm:size-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Undo</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            <div className="space-y-1">
              {turn.assistants.map(m => {
                const err = (m as Message & { error?: { data?: { message?: string }; message?: string; name?: string }; info?: { error?: { data?: { message?: string }; message?: string; name?: string } } }).error || (m as Message & { info?: { error?: { data?: { message?: string }; message?: string; name?: string } } }).info?.error;
                if (!err) return null;
                const msg = err.data?.message || err.message || err.name || "Request failed";
                if (msg.toLowerCase().includes("abort")) return null;
                return <ApiError key={m.id} error={err} />;
              })}

              {timeline.map(renderPart)}

              {isLast && unmatchedPermissions.map(permission => (
                <PermissionPrompt
                  key={permission.id}
                  permission={permission}
                  onRespond={response => respondToPermission(permission, response)}
                  responding={respondPermission.isPending && respondPermission.variables?.permissionId === permission.id}
                  error={permissionErrors[permission.id]}
                />
              ))}

              {showPlanning && (
                <ShimmeringText text="Working..." duration={0.4} className="text-xs sm:text-sm text-muted-foreground py-1" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
