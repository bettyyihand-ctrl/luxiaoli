"use client";

import { useState, useRef, useEffect } from "react";
import { ActionMode, Message } from "@/lib/types";
import { parseUserContext } from "@/lib/markdown";
import MarkdownMessage from "@/components/MarkdownMessage";
import {
  Calculator,
  MessageCircle,
  FileText,
  Wand2,
  Home as HomeIcon,
  Send,
  Plus,
  Lightbulb,
} from "lucide-react";

const MODES: ActionMode[] = process.env.NODE_ENV === "development"
  ? ["计算", "咨询", "文书", "霍格沃茨"]
  : ["计算", "咨询", "文书"];

const MODE_CONFIG: Record<ActionMode, { bg: string; desc: string }> = {
  计算:   { bg: "var(--color-pastel-yellow)",   desc: "估算赔偿金额与项目" },
  咨询:   { bg: "var(--color-pastel-pink)",     desc: "梳理责任与维权途径" },
  文书:   { bg: "var(--color-pastel-lavender)", desc: "起草法律文书模板" },
  霍格沃茨: { bg: "var(--color-pastel-mint)",   desc: "调试 API 与状态" },
};

const CONSULTATION_PROMPTS = [
  "对方全责但保险公司只愿意赔一部分，我应该怎么维权？",
  "交通事故后误工费、护理费、营养费通常如何计算？",
  "责任认定书下来后，对方拖着不处理，我下一步怎么做？",
];

function ModeIcon({
  mode,
  size = 20,
  strokeWidth = 1.75,
  className = "",
}: {
  mode: ActionMode;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const props = { size, strokeWidth, className };
  if (mode === "计算") return <Calculator {...props} />;
  if (mode === "咨询") return <MessageCircle {...props} />;
  if (mode === "文书") return <FileText {...props} />;
  return <Wand2 {...props} />;
}

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<ActionMode>("咨询");
  const [selectedDocType, setSelectedDocType] = useState<
    "和解协议" | "民事起诉状" | "证据目录"
  >("和解协议");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [userContext, setUserContext] = useState<Record<string, unknown>>({});
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const [attachTipVisible, setAttachTipVisible] = useState(false);
  const attachTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [apiRequestLog, setApiRequestLog] = useState("尚未发送请求。");
  const [apiResponseLog, setApiResponseLog] = useState("尚未收到返回。");

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: [
          {
            type: "text",
            text: "你好，我是路小理。你可以描述交通事故经过、上传票据或责任认定材料，我会帮你整理赔偿、咨询和文书思路。",
          },
        ],
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      streamAbortControllerRef.current?.abort();
      if (attachTipTimerRef.current) clearTimeout(attachTipTimerRef.current);
    };
  }, []);

  const handleAttachClick = () => {
    if (attachTipTimerRef.current) clearTimeout(attachTipTimerRef.current);
    setAttachTipVisible(true);
    attachTipTimerRef.current = setTimeout(() => setAttachTipVisible(false), 2500);
  };

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 148)}px`;
  };

  const handlePromptInsert = (prompt: string) => {
    if (isSending) return;
    setInputText(prompt);
    requestAnimationFrame(autoResizeTextarea);
  };

  const handleSend = async () => {
    if (isSending || !inputText.trim()) return;
    streamAbortControllerRef.current?.abort();

    const normalizedInput = inputText.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: [{ type: "text", text: normalizedInput }],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    requestAnimationFrame(autoResizeTextarea);
    setIsSending(true);

    const apiPayload = {
      messages: messages
        .concat(userMessage)
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content })),
      custom_variables: {
        actionType: selectedMode,
        ...(selectedMode === "文书" ? { docType: selectedDocType } : {}),
        ...(Object.keys(userContext).length > 0
          ? { userContext: JSON.stringify(userContext) }
          : {}),
      },
    };

    setApiRequestLog(
      JSON.stringify({ url: "/api/chat", method: "POST", body: apiPayload }, null, 2)
    );
    setApiResponseLog("正在等待 API 返回...");

    const aiMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: aiMessageId, role: "assistant", content: [], rawText: "" },
    ]);

    try {
      const controller = new AbortController();
      streamAbortControllerRef.current = controller;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        let detail = "";
        try {
          const errorBody = (await response.json()) as { error?: string };
          detail = errorBody.error ? ` - ${errorBody.error}` : "";
        } catch {
          /* ignore */
        }
        throw new Error(`API Error: ${response.status}${detail}`);
      }

      setApiResponseLog(`HTTP ${response.status} ${response.statusText}\n\n`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        let aiFullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setApiResponseLog((prev) => prev + chunk);
          buffer += chunk;

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                aiFullText += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMessageId
                      ? { ...m, rawText: aiFullText, content: [{ type: "text", text: aiFullText }] }
                      : m
                  )
                );
                setUserContext((prevContext) => parseUserContext(aiFullText, prevContext));
              }
            } catch {
              /* ignore */
            }
          }
        }

        const lastLine = buffer.trim();
        if (lastLine.startsWith("data:")) {
          const dataStr = lastLine.slice(5).trim();
          if (dataStr && dataStr !== "[DONE]") {
            try {
              const data = JSON.parse(dataStr);
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                aiFullText += delta;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMessageId
                      ? { ...m, rawText: aiFullText, content: [{ type: "text", text: aiFullText }] }
                      : m
                  )
                );
                setUserContext((prevContext) => parseUserContext(aiFullText, prevContext));
              }
            } catch {
              /* ignore */
            }
          }
        }

        setApiResponseLog((prev) => prev + `\n\n最终文本：\n${aiFullText}`);
      }
    } catch (e: unknown) {
      const fallbackText =
        e instanceof Error && e.name === "AbortError"
          ? "请求已取消，请重试。"
          : "请求失败，请稍后重试。";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMessageId
            ? { ...m, rawText: fallbackText, content: [{ type: "text", text: fallbackText }] }
            : m
        )
      );
      if (e instanceof Error) {
        setApiResponseLog((prev) => prev + `\n\nError: ${e.message}`);
      }
    } finally {
      streamAbortControllerRef.current = null;
      setIsSending(false);
    }
  };

  const hasUserMessages = messages.some((m) => m.id !== "welcome");

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex justify-center">
      <div className="w-full max-w-[480px] min-h-screen flex flex-col">

        {/* ── Header ── */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-5 h-14 bg-[var(--color-bg-base)]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[var(--color-primary)] grid place-items-center text-white font-semibold text-[15px] shadow-[var(--shadow-soft)]">
              路
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text-primary)] text-[16px] leading-none">路小理</p>
              <p className="text-[var(--color-text-tertiary)] text-[10px] mt-[2px] tracking-wider">LEXORA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 rounded-full bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] text-[12px] shadow-[var(--shadow-soft)] hover:text-[var(--color-text-primary)] transition-colors">
              免责声明
            </button>
            <form action="/api/logout" method="post" className="m-0">
              <button
                type="submit"
                className="px-3 py-1.5 rounded-full bg-[var(--color-nav-bg)] text-white text-[12px] shadow-[var(--shadow-soft)] hover:opacity-80 transition-opacity cursor-pointer"
              >
                退出
              </button>
            </form>
          </div>
        </header>

        {/* ── Main scrollable content ── */}
        <main className="flex-1 px-5 pb-[168px] overflow-y-auto">

          {/* Welcome heading (home state) */}
          {!hasUserMessages && (
            <section className="pt-4 pb-5">
              <p className="text-[var(--color-text-secondary)] text-[13px] font-medium">你好，欢迎回来</p>
              <h1
                className="text-[var(--color-text-primary)] text-[28px] font-bold leading-[1.3] mt-1"
                style={{ fontFamily: "var(--font-poppins), 'PingFang SC', sans-serif" }}
              >
                今天有什么可以<br />帮到你？
              </h1>
            </section>
          )}

          {/* Mode pill tabs (chat state) */}
          {hasUserMessages && (
            <div className="flex gap-2 pt-3 pb-4 flex-wrap">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                    selectedMode === mode
                      ? "bg-[var(--color-primary)] text-white shadow-[var(--shadow-soft)]"
                      : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] shadow-[var(--shadow-soft)]"
                  }`}
                >
                  <ModeIcon mode={mode} size={14} />
                  {mode === "霍格沃茨" ? "调试" : mode}
                </button>
              ))}
            </div>
          )}

          {/* Doc type selector (文书 mode, chat state) */}
          {selectedMode === "文书" && hasUserMessages && (
            <div className="flex gap-2 pb-3 flex-wrap">
              {(["和解协议", "民事起诉状", "证据目录"] as const).map((docType) => (
                <button
                  key={docType}
                  onClick={() => setSelectedDocType(docType)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                    selectedDocType === docType
                      ? "bg-[var(--color-pastel-lavender)] text-[var(--color-primary-deep)]"
                      : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] shadow-[var(--shadow-soft)]"
                  }`}
                >
                  {docType}
                </button>
              ))}
            </div>
          )}

          {/* Feature mode cards (home state) */}
          {!hasUserMessages && (
            <div className="grid grid-cols-2 gap-3">
              {MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  style={{ background: MODE_CONFIG[mode].bg }}
                  className={`rounded-[var(--radius-lg)] p-5 text-left shadow-[var(--shadow-soft)] transition-transform active:scale-[0.97] ${
                    selectedMode === mode
                      ? "ring-2 ring-[var(--color-primary-soft)] ring-offset-1 ring-offset-[var(--color-bg-base)]"
                      : ""
                  }`}
                >
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-white/60 grid place-items-center mb-3">
                    <ModeIcon
                      mode={mode}
                      size={20}
                      className="text-[var(--color-primary-deep)]"
                    />
                  </div>
                  <p className="font-semibold text-[var(--color-text-primary)] text-[15px]">
                    {mode === "霍格沃茨" ? "调试" : mode}
                  </p>
                  <p className="text-[var(--color-text-secondary)] text-[12px] mt-1">
                    {MODE_CONFIG[mode].desc}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Doc type selector (文书 mode, home state) */}
          {selectedMode === "文书" && !hasUserMessages && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {(["和解协议", "民事起诉状", "证据目录"] as const).map((docType) => (
                <button
                  key={docType}
                  onClick={() => setSelectedDocType(docType)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                    selectedDocType === docType
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] shadow-[var(--shadow-soft)]"
                  }`}
                >
                  {docType}
                </button>
              ))}
            </div>
          )}

          {/* AI welcome card (home state) */}
          {!hasUserMessages && (
            <div className="mt-4 rounded-[var(--radius-lg)] bg-[var(--color-primary-bg)] p-5 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] grid place-items-center shrink-0">
                  <span className="text-[var(--color-primary-deep)] font-semibold text-[13px]">理</span>
                </div>
                <p className="text-[var(--color-text-primary)] text-[14px] leading-[1.7] m-0 flex-1">
                  {messages.find((m) => m.id === "welcome")?.content.find((c) => c.type === "text")?.text}
                </p>
              </div>
            </div>
          )}

          {/* Consultation prompts (咨询 mode, home state) */}
          {selectedMode === "咨询" && !hasUserMessages && (
            <section className="mt-4">
              <p className="text-[var(--color-text-secondary)] text-[12px] font-medium mb-2.5 flex items-center gap-1.5">
                <Lightbulb size={13} strokeWidth={1.75} />
                常见问题，点击快速填入
              </p>
              <div className="flex flex-col gap-2">
                {CONSULTATION_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptInsert(prompt)}
                    className="w-full text-left px-4 py-3 rounded-[var(--radius-md)] bg-[var(--color-bg-card)] shadow-[var(--shadow-soft)] text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Chat messages (chat state) */}
          {hasUserMessages && (
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => (
                <article
                  key={msg.id || i}
                  className={`flex items-start gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role !== "user" && (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary-soft)] grid place-items-center shrink-0">
                      <span className="text-[var(--color-primary-deep)] font-semibold text-[12px]">理</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] rounded-[var(--radius-lg)] px-4 py-3 leading-[1.7] break-words text-[14px] shadow-[var(--shadow-soft)] ${
                      msg.role === "user"
                        ? "bg-[var(--color-primary)] text-white rounded-tr-[4px]"
                        : "bg-[var(--color-bg-card)] text-[var(--color-text-primary)] rounded-tl-[4px] markdown-body"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <span className="whitespace-pre-wrap">
                        {msg.content.find((c) => c.type === "text")?.text || "已发送内容"}
                      </span>
                    ) : msg.rawText === "" ? (
                      <span className="inline-flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-soft)] animate-pulse-custom" />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-soft)] animate-pulse-custom"
                          style={{ animationDelay: "0.12s" }}
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-soft)] animate-pulse-custom"
                          style={{ animationDelay: "0.24s" }}
                        />
                      </span>
                    ) : (
                      <MarkdownMessage rawText={msg.rawText || ""} />
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-pastel-pink)] grid place-items-center shrink-0">
                      <span className="text-[var(--color-text-secondary)] font-semibold text-[12px]">你</span>
                    </div>
                  )}
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Dev debug panel */}
          {process.env.NODE_ENV === "development" && selectedMode === "霍格沃茨" && (
            <details className="mt-4 rounded-[var(--radius-md)] bg-[var(--color-bg-card)] shadow-[var(--shadow-soft)] overflow-hidden">
              <summary className="min-h-[40px] flex items-center px-4 text-[var(--color-primary-deep)] text-[13px] font-semibold select-none cursor-pointer">
                API 调试：查看本次请求和返回
              </summary>
              <div className="grid grid-cols-1 gap-3 px-4 pb-4">
                <article>
                  <h3 className="m-[0_0_6px] text-[var(--color-text-secondary)] text-[12px] font-semibold">请求 payload</h3>
                  <pre className="min-h-[80px] max-h-[200px] overflow-auto m-0 border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] p-2.5 text-[var(--color-text-primary)] bg-[var(--color-bg-subtle)] font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words">
                    {apiRequestLog}
                  </pre>
                </article>
                <article>
                  <h3 className="m-[0_0_6px] text-[var(--color-text-secondary)] text-[12px] font-semibold">返回内容</h3>
                  <pre className="min-h-[80px] max-h-[200px] overflow-auto m-0 border border-[var(--color-border-subtle)] rounded-[var(--radius-sm)] p-2.5 text-[var(--color-text-primary)] bg-[var(--color-bg-subtle)] font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words">
                    {apiResponseLog}
                  </pre>
                </article>
              </div>
            </details>
          )}
        </main>

        {/* ── Fixed bottom bar (input + capsule nav) ── */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-5 pt-3 pointer-events-none">

          {/* Attachment tip */}
          {attachTipVisible && (
            <div
              role="status"
              aria-live="polite"
              className="mb-3 rounded-[var(--radius-md)] bg-[var(--color-bg-card)] px-4 py-3 text-[13px] text-[var(--color-text-secondary)] shadow-[var(--shadow-card)] pointer-events-auto"
            >
              票据与责任认定书图片识别功能即将上线，当前版本请在对话框中直接描述关键信息（如责任比例、伤残等级等）
            </div>
          )}

          {/* Input form */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-end gap-2 bg-[var(--color-bg-card)] rounded-full px-3 py-2 shadow-[var(--shadow-card)] pointer-events-auto"
          >
            {selectedMode !== "文书" && (
              <button
                type="button"
                aria-label="附件功能"
                onClick={handleAttachClick}
                className="w-9 h-9 rounded-full bg-[var(--color-bg-subtle)] grid place-items-center text-[var(--color-text-secondary)] hover:bg-[var(--color-primary-bg)] hover:text-[var(--color-primary-deep)] transition-colors shrink-0"
              >
                <Plus size={18} strokeWidth={1.75} />
              </button>
            )}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => { setInputText(e.target.value); autoResizeTextarea(); }}
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="描述事故经过、伤情、费用..."
              className="flex-1 min-h-[36px] max-h-[120px] resize-none border-0 bg-transparent outline-none text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] leading-[1.55] py-[7px]"
            />
            <button
              type="submit"
              disabled={isSending}
              className="w-9 h-9 rounded-full bg-[var(--color-primary)] grid place-items-center text-white hover:bg-[var(--color-primary-deep)] disabled:opacity-50 transition-colors shrink-0"
            >
              <Send size={16} strokeWidth={2} />
            </button>
          </form>

          {/* Bottom capsule navigation */}
          <nav className="flex justify-center mt-3 pointer-events-auto">
            <div
              className="flex items-center gap-1 rounded-full px-3 py-2 shadow-[var(--shadow-float)]"
              style={{ background: "var(--color-nav-bg)" }}
            >
              {/* Home icon */}
              <button
                title="首页"
                className={`w-12 h-10 rounded-full grid place-items-center transition-colors ${
                  !hasUserMessages
                    ? "bg-white/15 text-[var(--color-nav-icon)]"
                    : "text-[var(--color-nav-icon-idle)]"
                }`}
              >
                <HomeIcon size={20} strokeWidth={1.75} />
              </button>

              {/* Mode icons */}
              {MODES.slice(0, 3).map((mode) => (
                <button
                  key={mode}
                  title={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`w-12 h-10 rounded-full grid place-items-center transition-colors ${
                    selectedMode === mode && hasUserMessages
                      ? "bg-[var(--color-primary)] text-white"
                      : "text-[var(--color-nav-icon-idle)] hover:text-[var(--color-nav-icon)]"
                  }`}
                >
                  <ModeIcon mode={mode} size={20} />
                </button>
              ))}
            </div>
          </nav>
        </div>

      </div>
    </div>
  );
}
