"use client";

import { useState, useRef, useEffect } from "react";
import { Calculator, MessageCircle, FileText, Lightbulb, Plus, Send, LogOut, Info, Zap } from "lucide-react";
import { ActionMode, Message } from "@/lib/types";
import { parseUserContext } from "@/lib/markdown";
import MarkdownMessage from "@/components/MarkdownMessage";
import DisclaimerModal from "@/components/DisclaimerModal";

const MODES: ActionMode[] = process.env.NODE_ENV === 'development'
  ? ["计算", "咨询", "文书", "霍格沃茨"]
  : ["计算", "咨询", "文书"];

const getIconComponent = (mode: ActionMode) => {
  const iconProps = { strokeWidth: 1.5, size: 20 };
  const icons: Record<ActionMode, React.ReactNode> = {
    "计算": <Calculator {...iconProps} />,
    "咨询": <MessageCircle {...iconProps} />,
    "文书": <FileText {...iconProps} />,
    "霍格沃茨": <Zap {...iconProps} />
  };
  return icons[mode];
};

const getModeCardColor = (mode: ActionMode) => {
  const colors = {
    "计算": "bg-[var(--color-accent-yellow)]",
    "咨询": "bg-[var(--color-accent-pink)]",
    "文书": "bg-[var(--color-accent-lavender)]",
    "霍格沃茨": "bg-[var(--color-primary-bg)]"
  };
  return colors[mode];
};

const getModeIconBgColor = (mode: ActionMode) => {
  const colors = {
    "计算": "bg-[#E8D9B4]",
    "咨询": "bg-[#E8C9C5]",
    "文书": "bg-[#D0D2C8]",
    "霍格沃茨": "bg-[#C6D5E8]"
  };
  return colors[mode];
};
const ATTACH_TIP_TEXT = "票据与责任认定书图片识别功能即将上线，请在对话框中直接描述关键信息";

const CONSULTATION_PROMPTS = [
  "对方全责但保险公司只愿意赔一部分，我应该怎么维权？",
  "交通事故后误工费、护理费、营养费通常如何计算？",
  "责任认定书下来后，对方拖着不处理，我下一步怎么做？"
];

const getInputPlaceholder = (mode: ActionMode): string => {
  const placeholders: Record<ActionMode, string> = {
    "计算": "告诉我：事故发生地、责任比例、年龄、医疗费、住院/误工天数、月收入、有无伤残",
    "咨询": "描述事故情况和你想了解的法律问题",
    "文书": "请先在上方选择文书类型，再补充关键事实（当事人、事故时间地点、诉求金额等）",
    "霍格沃茨": "调试模式：输入任何信息进行测试"
  };
  return placeholders[mode];
};

export default function Home() {
  const [selectedMode, setSelectedMode] = useState<ActionMode>("计算");
  const [selectedDocType, setSelectedDocType] = useState<"和解协议" | "民事起诉状" | "证据目录">("和解协议");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [userContext, setUserContext] = useState<Record<string, unknown>>({});
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const streamAbortControllerRef = useRef<AbortController | null>(null);
  const [attachTipVisible, setAttachTipVisible] = useState(false);
  const attachTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  // API Debug states
  const [apiRequestLog, setApiRequestLog] = useState("尚未发送请求。");
  const [apiResponseLog, setApiResponseLog] = useState("尚未收到返回。");

  useEffect(() => {
    // Welcome message
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: [{ type: "text", text: "你好，我是路小理。你可以描述交通事故经过、上传票据或责任认定材料，我会帮你整理赔偿、咨询和文书思路。" }]
    }]);
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
    attachTipTimerRef.current = setTimeout(() => {
      setAttachTipVisible(false);
    }, 2500);
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

  const handleSend = async (overrideText?: string, overrideDocType?: "和解协议" | "民事起诉状" | "证据目录") => {
    const effectiveText = overrideText ?? inputText;
    if (isSending || (!effectiveText.trim())) return;
    streamAbortControllerRef.current?.abort();

    const normalizedInput = effectiveText.trim();
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: [{ type: "text", text: normalizedInput }]
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    requestAnimationFrame(autoResizeTextarea);
    setIsSending(true);

    const apiPayload = {
      messages: messages.concat(userMessage).filter(m => m.id !== "welcome").map(m => ({
        role: m.role,
        content: m.content
      })),
      custom_variables: {
        actionType: selectedMode,
        ...(selectedMode === '文书' ? { docType: overrideDocType ?? selectedDocType } : {}),
        ...(selectedMode !== '文书' && Object.keys(userContext).length > 0
          ? { userContext: JSON.stringify(userContext) }
          : {})
      }
    };

    setApiRequestLog(JSON.stringify({
      url: '/api/chat',
      method: 'POST',
      body: apiPayload
    }, null, 2));
    setApiResponseLog("正在等待 API 返回...");

    const aiMessageId = (Date.now() + 1).toString();
    const pendingDocType = selectedMode === "文书" ? (overrideDocType ?? selectedDocType) : undefined;
    setMessages(prev => [...prev, { id: aiMessageId, role: "assistant", content: [], rawText: "", docType: pendingDocType }]);

    try {
      const controller = new AbortController();
      streamAbortControllerRef.current = controller;
      const response = await fetch('/api/chat', {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(apiPayload),
        signal: controller.signal
      });

      if (!response.ok) {
        let detail = "";
        try {
          const errorBody = await response.json() as { error?: string };
          detail = errorBody.error ? ` - ${errorBody.error}` : "";
        } catch {
          // ignore parse errors
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
          setApiResponseLog(prev => prev + chunk);
          buffer += chunk;
          
          const lines = buffer.split('\n');
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
                 setMessages(prev => prev.map(m => {
                   if (m.id === aiMessageId) {
                     return { ...m, rawText: aiFullText, content: [{ type: "text", text: aiFullText }] };
                   }
                   return m;
                 }));
                 // Stream user context parsing as well
                 setUserContext(prevContext => parseUserContext(aiFullText, prevContext));
               }
            } catch {
               // ignore parse errors for chunks
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
                setMessages(prev => prev.map(m => {
                  if (m.id === aiMessageId) {
                    return { ...m, rawText: aiFullText, content: [{ type: "text", text: aiFullText }] };
                  }
                  return m;
                }));
                setUserContext(prevContext => parseUserContext(aiFullText, prevContext));
              }
            } catch {
              // ignore parse errors for trailing chunk
            }
          }
        }
        
        setApiResponseLog(prev => prev + `\n\n最终文本：\n${aiFullText}`);
      }
    } catch (e: unknown) {
      const fallbackText = e instanceof Error && e.name === "AbortError"
        ? "请求已取消，请重试。"
        : "请求失败，请稍后重试。";
      setMessages(prev => prev.map(m => {
         if (m.id === aiMessageId) {
           return { ...m, rawText: fallbackText, content: [{ type: "text", text: fallbackText }] };
         }
         return m;
      }));
      if (e instanceof Error) {
        setApiResponseLog(prev => prev + `\n\nError: ${e.message}`);
      }
    } finally {
      streamAbortControllerRef.current = null;
      setIsSending(false);
    }
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadDoc = async (rawText: string, docType: string, msgId: string) => {
    setDownloadingId(msgId);
    try {
      const res = await fetch("/api/generate-doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, docType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "未知错误" })) as { error?: string };
        alert(`文档生成失败：${err.error ?? res.statusText}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docType}.docx`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      alert(`下载失败，请重试。${err instanceof Error ? err.message : ""}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const TopBar = () => (
    <header className="flex lg:hidden fixed top-0 left-0 right-0 z-20 h-[var(--topbar-height)] items-center justify-between px-6 border-b border-[var(--color-border)] bg-[rgba(245,247,250,0.88)] backdrop-blur-md">
      <a className="inline-flex items-center gap-2.5 min-w-0 text-inherit no-underline" href="#app">
        <span className="w-[40px] h-[40px] grid place-items-center rounded-[8px] text-white bg-[var(--color-primary)] font-serif font-semibold text-lg">路</span>
        <span>
          <strong className="block font-serif text-[18px] leading-none text-[var(--color-text-primary)]">路小理</strong>
          <small className="block mt-[2px] text-[var(--color-text-tertiary)] text-[11px] tracking-wider">LEXORA</small>
        </span>
      </a>
      <div className="flex items-center gap-3">
        <button onClick={() => setDisclaimerOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] text-[var(--color-text-secondary)] bg-white border border-[var(--color-border)] rounded-[var(--radius-lg)] hover:bg-[var(--color-primary-bg)] transition-colors">
          <Info size={16} strokeWidth={1.5} />
          免责声明
        </button>
        <form action="/api/logout" method="post" className="m-0">
          <button type="submit" className="inline-flex items-center gap-1.5 px-3 py-2 text-[13px] text-white bg-[var(--color-text-primary)] border border-[var(--color-text-primary)] rounded-[var(--radius-lg)] hover:bg-[var(--color-primary)] transition-colors">
            <LogOut size={16} strokeWidth={1.5} />
            退出
          </button>
        </form>
      </div>
    </header>
  );

  const DesktopSidebar = () => (
    <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-10 w-[320px] bg-white border-r border-[var(--color-border)] pt-6">
      <div className="flex-1 p-6 overflow-y-auto flex flex-col">
        <div className="mb-8 pb-6 border-b border-[var(--color-border)] shrink-0">
          <a className="inline-flex items-center gap-3 text-inherit no-underline mb-2" href="#app">
            <span className="w-[44px] h-[44px] grid place-items-center rounded-[12px] text-white bg-[var(--color-primary)] font-serif font-semibold text-[20px]">路</span>
            <div>
              <strong className="block font-serif text-[16px] leading-tight text-[var(--color-text-primary)]">路小理</strong>
              <small className="block text-[11px] tracking-wider text-[var(--color-text-tertiary)]">LEXORA</small>
            </div>
          </a>
        </div>

        <div className="space-y-2 mb-8 shrink-0">
          <p className="text-[12px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-3">功能模式</p>
          {MODES.filter(m => m !== "霍格沃茨").map(mode => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] text-left transition-all relative border-l-3 ${
                selectedMode === mode
                  ? `${getModeCardColor(mode)} text-[var(--color-text-primary)] border-l-[var(--color-primary)] font-medium shadow-sm`
                  : 'text-[var(--color-text-secondary)] border-l-transparent hover:bg-[var(--color-bg-subtle)]'
              }`}
            >
              <span className={`flex-shrink-0 w-8 h-8 rounded-[6px] flex items-center justify-center ${getModeIconBgColor(mode)} text-[var(--color-text-primary)]`}>
                {getIconComponent(mode)}
              </span>
              <span className="text-[14px] font-medium">{mode}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={() => setSelectedMode("霍格沃茨")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] text-left transition-all border-l-3 mb-2 ${
              selectedMode === "霍格沃茨"
                ? "bg-[var(--color-primary-bg)] text-[var(--color-text-primary)] border-l-[var(--color-primary)] font-medium shadow-sm"
                : "text-[var(--color-text-secondary)] border-l-transparent hover:bg-[var(--color-bg-subtle)]"
            }`}
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-[6px] flex items-center justify-center bg-[#C6D5E8] text-[var(--color-text-primary)]">
              {getIconComponent("霍格沃茨")}
            </span>
            <span className="text-[14px] font-medium">调试</span>
          </button>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] p-6 space-y-2 shrink-0">
        <button onClick={() => setDisclaimerOpen(true)} className="w-full inline-flex items-center gap-2 justify-center px-4 py-2.5 text-[13px] text-[var(--color-text-secondary)] bg-white border border-[var(--color-border)] rounded-[var(--radius-lg)] hover:bg-[var(--color-primary-bg)] transition-colors">
          <Info size={16} strokeWidth={1.5} />
          免责声明
        </button>
        <form action="/api/logout" method="post" className="m-0">
          <button type="submit" className="w-full inline-flex items-center gap-2 justify-center px-4 py-2.5 text-[13px] text-white bg-[var(--color-text-primary)] border border-[var(--color-text-primary)] rounded-[var(--radius-lg)] hover:bg-[var(--color-primary)] transition-colors">
            <LogOut size={16} strokeWidth={1.5} />
            退出
          </button>
        </form>
      </div>
    </aside>
  );

  const MobileBottomNav = () => {
    const visibleModes = process.env.NODE_ENV === 'development' && selectedMode === '霍格沃茨'
      ? MODES
      : MODES.filter(m => m !== '霍格沃茨');

    return (
      <nav className="lg:hidden fixed left-0 right-0 bottom-0 z-30 flex justify-center items-center h-20 pointer-events-none">
        <div className="flex items-center gap-4 px-5 py-3 rounded-[var(--radius-pill)] bg-[var(--color-nav-bg)] shadow-lg pointer-events-auto">
          {visibleModes.map(mode => (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={`flex-shrink-0 p-2.5 rounded-[10px] transition-all ${
                selectedMode === mode
                  ? 'text-[var(--color-nav-icon)] bg-[var(--color-primary)]'
                  : 'text-[var(--color-nav-idle)] hover:text-[var(--color-nav-icon)]'
              }`}
              title={mode}
            >
              {getIconComponent(mode)}
            </button>
          ))}
        </div>
      </nav>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      <TopBar />
      <DesktopSidebar />

      <main className="min-h-dvh lg:h-screen lg:ml-[320px] flex flex-col p-4 md:p-6 lg:p-8 gap-6 pb-20 lg:pb-0 lg:overflow-hidden">
        <div className="max-w-[1024px] mx-auto w-full flex-1 flex flex-col gap-6 lg:overflow-hidden">
        {/* Header & Function Cards */}
        <section className="grid gap-6 shrink-0">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-[28px] md:text-[32px] font-[600] text-[var(--color-text-primary)] mb-2 font-serif">路小理助手</h1>
            <p className="text-[15px] text-[var(--color-text-secondary)] leading-[1.6]">
              交通纠纷法律智能助手，帮助您快速获得专业建议
            </p>
          </div>

          {!messages.some(m => m.id !== "welcome") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
              {MODES.filter(m => m !== '霍格沃茨').map(mode => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`text-left p-5 rounded-[var(--radius-lg)] transition-all min-h-[160px] border-2 cursor-pointer group ${
                    selectedMode === mode
                      ? `${getModeCardColor(mode)} border-[var(--color-primary)] shadow-md`
                      : `${getModeCardColor(mode)} border-transparent hover:shadow-md hover:translate-y-[-2px]`
                  }`}
                >
                  <div className={`w-12 h-12 rounded-[8px] flex items-center justify-center mb-3 text-[var(--color-text-primary)] ${getModeIconBgColor(mode)}`}>
                    {getIconComponent(mode)}
                  </div>
                  <h3 className="text-[16px] font-[500] text-[var(--color-text-primary)] mb-1">{mode}</h3>
                  <p className="text-[12px] text-[var(--color-text-secondary)] leading-[1.5]">
                    {mode === '计算' && "估算赔偿金额"}
                    {mode === '咨询' && "法律问题咨询"}
                    {mode === '文书' && "法律文书生成"}
                  </p>
                </button>
              ))}
            </div>
          )}

          {selectedMode === '文书' && (
            <div className="flex gap-2 flex-wrap">
              {(["和解协议", "民事起诉状", "证据目录"] as const).map(docType => {
                const docPromptMap: Record<string, string> = {
                  "和解协议": "我想起草一份和解协议",
                  "民事起诉状": "我想起草一份民事起诉状",
                  "证据目录": "我想起草一份证据目录",
                };
                return (
                  <button
                    key={docType}
                    onClick={() => {
                      setSelectedDocType(docType);
                      handleSend(docPromptMap[docType], docType);
                    }}
                    className={`px-4 py-2 rounded-[var(--radius-pill)] text-[13px] font-medium transition-all border-2 ${
                      selectedDocType === docType
                        ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                        : "bg-white text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-[var(--color-primary)]"
                    }`}
                  >
                    {docType}
                  </button>
                );
              })}
            </div>
          )}

          {process.env.NODE_ENV === 'development' && (
            <details className="border border-[var(--color-border)] rounded-[var(--radius-lg)] bg-white shadow-[var(--shadow-sm)] mt-2">
              <summary className="min-h-[44px] flex items-center px-4 text-[var(--color-primary)] text-[13px] font-semibold select-none cursor-pointer">
                <Zap size={16} className="mr-2" strokeWidth={1.5} />
                API 调试
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4 bg-[var(--color-bg-subtle)]">
                <article className="min-w-0">
                  <h3 className="m-[0_0_6px] text-[var(--color-text-secondary)] text-[12px] font-semibold">请求 payload</h3>
                  <pre className="min-h-[112px] max-h-[240px] overflow-auto m-0 border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-[#0F172A] bg-white font-mono text-[11px] leading-[1.55] whitespace-pre-wrap break-words">{apiRequestLog}</pre>
                </article>
                <article className="min-w-0">
                  <h3 className="m-[0_0_6px] text-[var(--color-text-secondary)] text-[12px] font-semibold">返回内容</h3>
                  <pre className="min-h-[112px] max-h-[240px] overflow-auto m-0 border border-[var(--color-border)] rounded-[var(--radius-md)] p-3 text-[#0F172A] bg-white font-mono text-[11px] leading-[1.55] whitespace-pre-wrap break-words">{apiResponseLog}</pre>
                </article>
              </div>
            </details>
          )}
        </section>

        {/* Chat Panel / Initial Hero */}
        {messages.some(m => m.id !== "welcome") ? (
          <section className="flex-1 flex flex-col bg-white rounded-[var(--radius-lg)] shadow-[var(--shadow-md)] overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] shrink-0">
              <span className="text-[14px] font-semibold text-[var(--color-text-primary)]">对话</span>
              <span className="text-[12px] text-[var(--color-text-secondary)] flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5">{getIconComponent(selectedMode)}</span>
                <span>{selectedMode === '霍格沃茨' ? '调试' : selectedMode}模式</span>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth min-h-0">
              {messages.map((msg, i) => (
                <article key={msg.id || i} className={`flex items-start gap-3 mb-5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                   <div className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-[8px] text-[14px] font-medium ${
                     msg.role === 'user'
                       ? 'order-2 text-white bg-[var(--color-primary)]'
                       : 'text-[var(--color-primary)] bg-[var(--color-primary-bg)]'
                   }`}>
                     {msg.role === 'user' ? '你' : '理'}
                   </div>
                   <div className="flex flex-col gap-2 max-w-[85%] md:max-w-[min(720px,75%)]">
                     <div className={`rounded-[var(--radius-lg)] md:p-4 p-3 text-[12px] leading-[1.65] break-words ${
                       msg.role === 'user'
                         ? 'text-white bg-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                         : 'text-[var(--color-text-primary)] bg-[var(--color-bg-subtle)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] markdown-body'
                     }`}>
                       {msg.role === 'user' ? (
                         <span className="whitespace-pre-wrap">
                           {msg.content.find(c => c.type === 'text')?.text || '已发送内容'}
                         </span>
                       ) : (
                         msg.rawText === ""
                            ? <span className="inline-flex gap-1 items-center">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-secondary)] animate-pulse-custom"></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-secondary)] animate-pulse-custom" style={{animationDelay: '0.12s'}}></span>
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-secondary)] animate-pulse-custom" style={{animationDelay: '0.24s'}}></span>
                              </span>
                            : <MarkdownMessage rawText={msg.rawText || ""} />
                       )}
                     </div>
                     {msg.role === 'assistant' && msg.docType && msg.rawText && (
                       <button
                         type="button"
                         disabled={downloadingId === msg.id}
                         onClick={() => handleDownloadDoc(msg.rawText!, msg.docType!, msg.id)}
                         className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-[13px] font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-primary-bg)] hover:border-[var(--color-primary)] transition-colors shadow-[var(--shadow-sm)] disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         <span>{downloadingId === msg.id ? "⏳" : "⬇"}</span>
                         <span>{downloadingId === msg.id ? "生成中…" : `下载${msg.docType} Word 文档`}</span>
                       </button>
                     )}
                   </div>
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </section>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 select-none min-h-0">
            <p className="m-0 text-[48px] leading-none">💭</p>
            <p className="m-0 font-serif text-[20px] text-[var(--color-text-primary)]">开始对话</p>
            <p className="m-0 text-[14px] text-[var(--color-text-secondary)]">选择一个功能模式，描述你的情况</p>
          </div>
        )}

        {/* Quick Prompts */}
        {selectedMode === '咨询' && messages.some(m => m.id !== "welcome") && (
          <section className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-[12px] text-[var(--color-text-secondary)] font-medium flex items-center gap-1">
              <Lightbulb size={14} strokeWidth={1.5} />
              快速问题
            </span>
            {CONSULTATION_PROMPTS.map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => handlePromptInsert(prompt)}
                className="px-3 py-1.5 rounded-[var(--radius-pill)] border border-[var(--color-border)] text-[12px] text-[var(--color-text-secondary)] bg-white hover:bg-[var(--color-primary-bg)] hover:border-[var(--color-primary)] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </section>
        )}

        {/* Input & Attachment Tip */}
        <div className="relative shrink-0 mt-4" style={{ marginBottom: 'var(--chat-input-bottom-gap)' }}>
          {attachTipVisible && (
            <div
              role="status"
              aria-live="polite"
              className="absolute left-0 right-0 bottom-full mb-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white px-4 py-3 text-sm text-[var(--color-text-secondary)] shadow-[var(--shadow-md)] transition-opacity duration-200 opacity-100 z-20"
            >
              <span className="flex items-center gap-2">
                <Lightbulb size={14} strokeWidth={1.5} />
                {ATTACH_TIP_TEXT}
              </span>
            </div>
          )}

          <form
            onSubmit={e => { e.preventDefault(); handleSend(); }}
            className="grid items-end gap-2 p-3 border border-[var(--color-border)] rounded-[var(--radius-xl)] bg-white shadow-[var(--shadow-md)] grid-cols-[44px_minmax(0,1fr)_44px]"
          >
            <button
              type="button"
              aria-label="附件功能"
              onClick={handleAttachClick}
              className="flex items-center justify-center w-11 h-11 rounded-[10px] border-0 bg-[var(--color-primary-bg)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-colors flex-shrink-0"
            >
              <Plus size={20} strokeWidth={1.5} />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={e => {
                setInputText(e.target.value);
                autoResizeTextarea();
              }}
              disabled={isSending}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={getInputPlaceholder(selectedMode)}
              className="w-full min-h-11 max-h-[120px] resize-none border-0 rounded-[10px] p-3 text-[14px] text-[var(--color-text-primary)] bg-[var(--color-bg-subtle)] leading-[1.55] outline-none placeholder-[var(--color-text-tertiary)] focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={isSending}
              className="flex items-center justify-center w-11 h-11 rounded-[10px] border-0 bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-deep)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send size={18} strokeWidth={1.5} />
            </button>
          </form>
        </div>
        </div>
      </main>

      <MobileBottomNav />
      <DisclaimerModal open={disclaimerOpen} onOpenChange={setDisclaimerOpen} />
    </div>
  );
}
