import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { studentApi } from "../services/studentApi";
import { X, Send, History, Plus, MessageSquare } from "lucide-react";
import { Problem } from "../data/mockData";

export interface AiChatPanelProps {
  problem: Problem;
  code: string;
  onClose: () => void;
}

interface ChatMessage {
  role: "ai" | "user";
  content: string;
}

export function AiChatPanel({ problem, code, onClose }: AiChatPanelProps) {
  const defaultMessage = {
    role: "ai" as const,
    content: `Xin chào! Mình là trợ lý AI. Mình có thể giúp gì cho bạn với bài tập "${problem.title}"?`,
  };

  const [messages, setMessages] = useState<ChatMessage[]>([defaultMessage]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchSessions = async () => {
    try {
      const data = await studentApi.getAiChatSessions(problem.id);
      setSessions(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [problem.id]);

  const loadSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const msgs = await studentApi.getAiChatMessages(sessionId);
      if (msgs && msgs.length > 0) {
        setMessages(msgs.map((m: any) => ({ role: m.role, content: m.content })));
        setCurrentSessionId(sessionId);
        setShowHistory(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages([defaultMessage]);
    setCurrentSessionId(undefined);
    setShowHistory(false);
  };

  useEffect(() => {
    if (scrollRef.current && !showHistory) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, showHistory]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = input.trim();
    setInput("");
    
    const newMessages = [...messages, { role: "user", content: userMsg } as ChatMessage];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await studentApi.askAi(
        problem, 
        code, 
        userMsg, 
        currentSessionId
      );
      setMessages([...newMessages, { role: "ai", content: response.response }]);
      
      if (!currentSessionId && response.sessionId) {
        setCurrentSessionId(response.sessionId);
        fetchSessions(); // Refresh history
      }
    } catch (error: any) {
      setMessages([...newMessages, { role: "ai", content: `Có lỗi xảy ra: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="ai-chat-title">
          <span className="sparkles-icon">✨</span> Ask AI
        </div>
        <div className="ai-chat-actions">
          <button className="icon-button" onClick={startNewChat} aria-label="New chat" title="New chat">
            <Plus size={18} />
          </button>
          <button className={"icon-button " + (showHistory ? "active" : "")} onClick={() => setShowHistory(!showHistory)} aria-label="Chat history" title="History">
            <History size={18} />
          </button>
          <button className="icon-button" onClick={onClose} aria-label="Close AI panel" title="Close">
            <X size={18} />
          </button>
        </div>
      </div>
      
      <div className="ai-chat-body">
        {showHistory ? (
          <div className="ai-chat-history-list">
            {sessions.length === 0 ? (
              <div className="empty-history">Chưa có lịch sử đoạn chat nào.</div>
            ) : (
              sessions.map(s => (
                <button 
                  key={s.id} 
                  className={"history-item " + (s.id === currentSessionId ? "active" : "")}
                  onClick={() => loadSession(s.id)}
                >
                  <MessageSquare size={16} />
                  <span>{new Date(s.createdAt || s.created_at).toLocaleString()}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="ai-chat-messages" ref={scrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`ai-message ${msg.role}`}>
                <div className="message-bubble">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="ai-message ai">
                <div className="message-bubble loading">
                  Đang suy nghĩ...
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="ai-chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSend();
            }
          }}
          placeholder="Nhập câu hỏi của bạn..."
          disabled={isLoading || showHistory}
        />
        <button 
          className="send-button" 
          onClick={handleSend}
          disabled={isLoading || showHistory || !input.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
