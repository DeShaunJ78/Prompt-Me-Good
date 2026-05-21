import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useProjectBrain } from "@/context/ProjectBrainContext";
import { useTier } from "@/context/TierContext";
import LiveRender from "@/components/render/LiveRender";
import { sendCompanionMessage } from "@/api/companion";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

const TABS = [
  { id: "chat",   label: "Chat",        icon: "💬" },
  { id: "render", label: "Live Render", icon: "⚡" },
];

function ChatPanel({ chatMessages, addChatMessage, project, flightLog, tier }) {
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, loading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    addChatMessage("user", trimmed);
    setInput("");
    setLoading(true);

    const apiMessages = [
      ...chatMessages.map((m) => ({ role: m.role, content: m.text })),
      { role: "user", content: trimmed },
    ];

    try {
      const response = await sendCompanionMessage({
        messages:    apiMessages,
        projectBrain: project,
        flightLog:   flightLog.slice(-5),
        action:      "chat",
        tier,
      });
      addChatMessage("assistant", response);
    } catch (err) {
      console.error("[ChatPanel] companion error:", err);
      addChatMessage("assistant", "I'm having trouble connecting right now. Your progress is saved — try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {chatMessages.map((msg) => (
          <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mr-2 mt-0.5 bg-secondary text-white">
                AI
              </div>
            )}
            <div className={cn(
              "max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
              msg.role === "user"
                ? "bg-cta text-inverse rounded-br-sm"
                : "bg-elevated text-body rounded-bl-sm"
            )}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mr-2 mt-0.5 bg-secondary text-white">
              AI
            </div>
            <div className="bg-elevated text-body rounded-xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-subtle animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-subtle animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-subtle animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-panel shrink-0">
        <div className="relative">
          <textarea
            className="w-full text-sm rounded-lg px-3 py-2 pr-10 resize-none min-h-[38px] max-h-[80px] bg-elevated text-heading border border-panel placeholder:text-subtle caret-primary focus:outline-none focus:border-primary transition-colors"
            placeholder="Ask your build companion…"
            aria-label="Chat message"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={cn(
              "absolute right-2 bottom-2 w-6 h-6 rounded flex items-center justify-center transition-all",
              input.trim() && !loading ? "text-primary cursor-pointer hover:text-primary-hover" : "text-subtle cursor-not-allowed"
            )}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11h2v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}

export default function RightPanel() {
  const { chatMessages, addChatMessage, project, flightLog } = useProjectBrain();
  const { tier } = useTier();
  const [activeTab, setActiveTab] = useState("chat");
  const isMobile = useIsMobile();
  const isRender = activeTab === "render";

  const desktopWidth = isRender ? "clamp(520px, 55vw, 900px)" : "288px";

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden transition-all duration-300 bg-surface border-t border-panel md:border-t-0 md:border-l md:border-panel w-full md:w-auto"
      style={isMobile ? undefined : { width: desktopWidth }}
    >
      <div className="flex px-2 py-2 gap-1 shrink-0 border-b border-panel">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
              activeTab === tab.id
                ? "bg-primary/10 text-primary border-primary/25"
                : "bg-transparent text-subtle border-transparent hover:text-body"
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === "chat" && (
          <ChatPanel
            chatMessages={chatMessages}
            addChatMessage={addChatMessage}
            project={project}
            flightLog={flightLog}
            tier={tier}
          />
        )}
        {activeTab === "render" && <LiveRender />}
      </div>
    </aside>
  );
}
