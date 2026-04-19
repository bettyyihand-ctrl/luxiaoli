"use client";

import { useState, useRef, useEffect } from "react";
import { ActionMode, Message } from "@/lib/types";
import { parseUserContext } from "@/lib/markdown";
import MarkdownMessage from "@/components/MarkdownMessage";

const MODES: ActionMode[] = process.env.NODE_ENV === 'development'
  ? ["计算", "咨询", "文书", "霍格沃茨"]
  : ["计算", "咨询", "文书"];
const ICONS: Record<ActionMode, string> = {
  "计算": "🧮",
  "咨询": "💬",
  "文书": "📄",
  "霍格沃茨": "🪄"
};
const CONSULTATION_PROMPTS = [
  "对方全责但保险公司只愿意赔一部分，我应该怎么维权？",
  "交通事故后误工费、护理费、营养费通常如何计算？",
  "责任认定书下来后，对方拖着不处理，我下一步怎么做？"
];

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

  const handleSend = async () => {
    if (isSending || (!inputText.trim())) return;
    streamAbortControllerRef.current?.abort();
    
    const normalizedInput = inputText.trim();
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
        ...(selectedMode === '文书' ? { docType: selectedDocType } : {}),
        ...(Object.keys(userContext).length > 0 ? { userContext: JSON.stringify(userContext) } : {})
      }
    };

    setApiRequestLog(JSON.stringify({
      url: '/api/chat',
      method: 'POST',
      body: apiPayload
    }, null, 2));
    setApiResponseLog("正在等待 API 返回...");

    const aiMessageId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: aiMessageId, role: "assistant", content: [], rawText: "" }]);

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

  const TopBar = () => (
    <header className="fixed top-0 left-0 right-0 z-20 h-[var(--topbar-height)] flex items-center justify-between px-6 border-b border-[rgba(17,17,17,0.12)] bg-[rgba(245,247,250,0.88)] backdrop-blur-md">
      <a className="inline-flex items-center gap-2.5 min-w-0 text-inherit no-underline" href="#app">
        <span className="w-[34px] h-[34px] grid place-items-center rounded-sm text-[#111] bg-[#FDE047] font-serif font-semibold">路</span>
        <span>
          <strong className="block font-serif text-[20px] leading-none">路小理</strong>
          <small className="block mt-[2px] text-[var(--color-text-secondary)] text-[11px] tracking-normal">Lexora</small>
        </span>
      </a>
      <div className="flex items-center gap-3">
        <button className="border border-[rgba(17,17,17,0.14)] rounded-sm px-2.5 py-1.5 text-[var(--color-text-primary)] bg-white hover:bg-[#FDE047] transition-colors text-[13px]">免责声明</button>
        <form action="/api/logout" method="post" className="m-0">
          <button type="submit" className="border border-[rgba(17,17,17,0.14)] rounded-sm px-2.5 py-1.5 text-white bg-[#111] hover:bg-[#E84A5F] transition-colors text-[13px] font-medium cursor-pointer">退出</button>
        </form>
      </div>
    </header>
  );

  const Sidebar = () => (
    <aside className="fixed top-[var(--topbar-height)] left-0 bottom-0 z-10 w-[var(--sidebar-width)] p-5 lg:p-3 bg-[var(--color-sidebar)] text-white hidden md:block group hover:w-[220px] transition-all duration-300 overflow-hidden md:w-[56px] xl:w-[220px]">
      <div className="before:content-['LEGAL_ROUTES'] before:block before:mx-2 before:mb-[18px] before:text-[#FDE047] before:text-[11px] before:font-semibold">
        {MODES.map(mode => (
          <button
            key={mode}
            onClick={() => setSelectedMode(mode)}
            className={`w-full min-h-[44px] flex items-center gap-2.5 mb-2 p-2.5 rounded-sm border text-left whitespace-nowrap transition-colors ${
              selectedMode === mode 
                ? 'text-[#111] bg-[var(--color-sidebar-active)] border-[var(--color-sidebar-active)]' 
                : 'text-[rgba(255,255,255,0.78)] bg-transparent border-[rgba(255,255,255,0.12)] hover:text-[#111] hover:bg-[var(--color-sidebar-active)] hover:border-[var(--color-sidebar-active)]'
            }`}
          >
            <span className="w-6 shrink-0 text-center">{ICONS[mode]}</span>
            <span className="md:opacity-0 xl:opacity-100 group-hover:opacity-100 transition-opacity">{mode}</span>
          </button>
        ))}
      </div>
    </aside>
  );

  const MobileTabs = () => (
    <nav className="fixed left-0 right-0 bottom-0 z-25 h-[56px] grid grid-cols-4 border-t border-[var(--color-border)] bg-[rgba(255,255,255,0.94)] backdrop-blur-md md:hidden">
      {MODES.map(mode => (
        <button
          key={mode}
          onClick={() => setSelectedMode(mode)}
          className={`grid place-items-center gap-px border-0 text-[12px] transition-colors ${
            selectedMode === mode ? 'text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-secondary)] bg-transparent'
          }`}
        >
          <span className="text-[18px]">{ICONS[mode]}</span>
          {mode.replace('霍格沃茨', '调试')}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen pt-[var(--topbar-height)]">
      <TopBar />
      <Sidebar />

      <main className="min-h-[calc(100vh-var(--topbar-height))] md:ml-[56px] xl:ml-[var(--sidebar-width)] grid grid-rows-[auto_minmax(0,1fr)_auto] p-3 md:p-5 lg:p-7 gap-[14px]">
        {/* Mode Section & Artboard */}
        <section className="grid gap-2.5">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(200px,0.5fr)] gap-0 min-h-[140px] border border-[rgba(17,17,17,0.14)] rounded-sm bg-[rgba(255,255,255,0.9)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="grid content-center gap-1.5 p-[14px_18px] md:p-[18px_22px]">
              <span className="text-[var(--color-accent)] text-[11px] font-semibold tracking-wider uppercase">交通纠纷助手 · Lexora</span>
              <h1 className="max-w-[640px] m-0 font-serif text-[clamp(22px,3vw,40px)] leading-[1.12] font-semibold">把事故线索，整理成可行动的答案。</h1>
              <p className="max-w-[560px] m-0 text-[var(--color-text-secondary)] text-[13px] leading-[1.6]">
                {selectedMode === '计算' && "上传票据、责任认定书或描述案情，帮你估算赔偿项目。"}
                {selectedMode === '咨询' && "描述事故经过或伤情，帮你梳理法律责任与维权途径。"}
                {selectedMode === '文书' && "提供双方信息与诉求，为你起草交通纠纷法律文书。"}
                {selectedMode === '霍格沃茨' && "调试模式：暴露系统内部 API 与 Context 状态。"}
              </p>
              {selectedMode === '咨询' && (
                <p className="max-w-[560px] m-0 text-[12px] leading-[1.6] text-[var(--color-text-secondary)]">
                  建议补充信息：事故时间地点、责任划分、伤情与治疗情况、已发生费用、对方/保险沟通进展。
                </p>
              )}
            </div>
            <figure className="relative min-h-[110px] md:min-h-0 m-0 bg-[#111] md:clip-art">
              <img src="https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=960&q=82" alt="城市道路与车流" className="w-full h-full min-h-[110px] block object-cover grayscale-[0.1] contrast-[1.08] saturate-[0.86]" />
              <div className="absolute inset-0 bg-gradient-to-br from-[rgba(15,118,110,0.52)] via-[rgba(232,74,95,0.16)_48%] to-[rgba(253,224,71,0.18)] mix-blend-multiply"></div>
            </figure>
          </div>

          <div className="flex items-center gap-3">
            <span className="shrink-0 text-[var(--color-text-secondary)] text-[12px] font-medium hidden sm:block">功能模式</span>
            <div className="flex-1 sm:flex-none inline-grid grid-cols-4 p-[3px] border border-[rgba(17,17,17,0.16)] rounded-sm bg-white shadow-[var(--shadow-card)]">
              {MODES.map(mode => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`min-w-0 sm:min-w-[80px] min-h-[34px] border-0 rounded-sm bg-transparent transition-colors text-[13px] ${
                    selectedMode === mode ? 'text-[#111] bg-[#FDE047] font-semibold' : 'text-[var(--color-text-secondary)] hover:text-[#111]'
                  }`}
                >
                  {mode.replace('霍格沃茨', '调试')}
                </button>
              ))}
            </div>
          </div>

          {selectedMode === '文书' && (
            <div className="w-full md:w-fit inline-grid grid-cols-3 p-[3px] border border-[rgba(17,17,17,0.16)] rounded-sm bg-white shadow-[var(--shadow-card)]">
              {(["和解协议", "民事起诉状", "证据目录"] as const).map(docType => (
                <button
                  key={docType}
                  onClick={() => setSelectedDocType(docType)}
                  className={`min-w-0 md:min-w-[96px] min-h-[34px] border-0 rounded-sm bg-transparent transition-colors text-sm ${
                    selectedDocType === docType ? 'text-[#111] bg-[#FDE047] font-semibold' : 'text-[var(--color-text-secondary)]'
                  }`}
                >
                  {docType}
                </button>
              ))}
            </div>
          )}

          {process.env.NODE_ENV === 'development' && (
            <details className="border border-[rgba(17,17,17,0.14)] rounded-sm bg-white shadow-[var(--shadow-card)] mt-2">
              <summary className="min-h-[38px] flex items-center px-3 text-[var(--color-accent)] text-[13px] font-semibold select-none cursor-pointer">API 调试：查看本次请求和返回</summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 px-3 pb-3">
                <article className="min-w-0">
                  <h3 className="m-[0_0_6px] text-[var(--color-text-secondary)] text-[12px] font-semibold">请求 payload</h3>
                  <pre className="min-h-[112px] max-h-[240px] overflow-auto m-0 border border-[var(--color-border)] rounded-sm p-2.5 text-[#0F172A] bg-[#F8FAFC] font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words">{apiRequestLog}</pre>
                </article>
                <article className="min-w-0">
                  <h3 className="m-[0_0_6px] text-[var(--color-text-secondary)] text-[12px] font-semibold">返回内容</h3>
                  <pre className="min-h-[112px] max-h-[240px] overflow-auto m-0 border border-[var(--color-border)] rounded-sm p-2.5 text-[#0F172A] bg-[#F8FAFC] font-mono text-[12px] leading-[1.55] whitespace-pre-wrap break-words">{apiResponseLog}</pre>
                </article>
              </div>
            </details>
          )}
        </section>

        {/* Chat Panel / Initial Hero */}
        {messages.some(m => m.id !== "welcome") ? (
          <section className="min-h-[260px] md:min-h-[360px] border border-[rgba(17,17,17,0.14)] rounded-sm bg-[rgba(255,255,255,0.92)] shadow-[var(--shadow-panel)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(17,17,17,0.08)] bg-[rgba(248,250,252,0.9)] shrink-0">
              <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">对话</span>
              <span className="text-[12px] text-[var(--color-text-secondary)] flex items-center gap-1">
                <span>{ICONS[selectedMode]}</span>
                <span>{selectedMode === '霍格沃茨' ? '调试' : selectedMode}模式</span>
              </span>
            </div>
            <div className="flex-1 max-h-[calc(100vh-300px)] md:max-h-[calc(100vh-262px)] overflow-y-auto p-3.5 md:p-6 scroll-smooth">
              {messages.map((msg, i) => (
                <article key={msg.id || i} className={`flex items-start gap-2.5 md:mb-[18px] mb-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                   <div className={`w-8 h-8 shrink-0 grid place-items-center rounded-sm text-[15px] ${msg.role === 'user' ? 'order-2 text-white bg-[var(--color-accent)]' : 'text-[#111] bg-[#FDE047]'}`}>
                     {msg.role === 'user' ? '你' : '理'}
                   </div>
                   <div className={`max-w-[86%] md:max-w-[min(720px,78%)] border rounded-sm md:p-[13px_15px] p-[10px_12px] leading-[1.72] break-words ${
                     msg.role === 'user'
                       ? 'text-white border-[var(--color-accent)] bg-[var(--color-accent)] shadow-[8px_8px_0_rgba(232,74,95,0.14)]'
                       : 'border-[rgba(17,17,17,0.12)] bg-white shadow-[8px_8px_0_rgba(17,17,17,0.035)] markdown-body'
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
                </article>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-8 select-none">
            <span className="text-[48px] leading-none">🚗</span>
            <p className="m-0 font-serif text-[18px] text-[var(--color-text-primary)]">路小理</p>
            <p className="m-0 text-[13px] text-[var(--color-text-secondary)]">你的交通纠纷法律助手</p>
            <p className="m-0 text-[12px] text-[var(--color-text-secondary)] mt-1">开始描述你的情况</p>
          </div>
        )}

        {/* Composer */}
        {selectedMode === '咨询' && (
          <section className="flex flex-wrap items-center gap-2 -mt-2">
            <span className="text-[12px] text-[var(--color-text-secondary)]">咨询示例</span>
            {CONSULTATION_PROMPTS.map(prompt => (
              <button
                key={prompt}
                type="button"
                onClick={() => handlePromptInsert(prompt)}
                className="min-h-[30px] px-2.5 rounded-sm border border-[rgba(17,17,17,0.12)] text-[12px] text-[var(--color-text-secondary)] bg-white hover:text-[#111] hover:border-[var(--color-primary)] transition-colors"
              >
                {prompt}
              </button>
            ))}
          </section>
        )}
        <div className="relative">
          {attachTipVisible && (
            <div
              role="status"
              aria-live="polite"
              className="absolute left-4 bottom-full mb-2 max-w-[420px] w-[calc(100%-2rem)] rounded-xl border border-[#E5E7EB] bg-white px-4 py-3 text-sm text-[#374151] shadow-md transition-opacity duration-200 opacity-100 z-20"
            >
              📎 票据与责任认定书图片识别功能即将上线，当前版本请在对话框中直接描述关键信息（如责任比例、伤残等级等）
            </div>
          )}
          <form
            onSubmit={e => { e.preventDefault(); handleSend(); }}
            className={`grid items-end md:gap-2.5 gap-2 p-2 md:p-3 border border-[rgba(17,17,17,0.16)] rounded-sm bg-white shadow-[var(--shadow-card)] mb-14 md:mb-0 ${
              selectedMode === '文书'
                ? "grid-cols-[minmax(0,1fr)_64px] md:grid-cols-[minmax(0,1fr)_72px]"
                : "grid-cols-[40px_minmax(0,1fr)_64px] md:grid-cols-[42px_minmax(0,1fr)_72px]"
            }`}
          >
           {selectedMode !== '文书' && (
             <button type="button" aria-label="附件功能" onClick={handleAttachClick} className="min-h-[42px] border-0 rounded-sm text-[#111] bg-[#FDE047] text-[24px] leading-none hover:bg-[#FACC15] transition-colors">＋</button>
           )}
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
             placeholder="描述事故经过、伤情、费用或想咨询的问题..."
             className="w-full min-h-[42px] max-h-[148px] resize-none border border-transparent rounded-sm p-[9px_10px] text-[var(--color-text-primary)] bg-[#F5F7FA] leading-[1.55] outline-none focus:border-[var(--color-primary)] focus:bg-white transition-colors"
           />
           <button type="submit" disabled={isSending} className="min-h-[42px] border-0 rounded-sm text-white bg-[#111] font-semibold hover:bg-[var(--color-accent)] disabled:opacity-56 disabled:cursor-not-allowed transition-colors">发送</button>
          </form>
        </div>

      </main>

      <MobileTabs />
    </div>
  );
}
