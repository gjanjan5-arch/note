import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, RefreshCw, Cpu } from 'lucide-react';
import type { ChatMessage } from '../types';
import { translate, type LanguageCode } from '../utils/i18n';

interface SukiChatbotProps {
  isOnline: boolean;
  lang: LanguageCode;
}

const PRESET_QUESTIONS = [
  'Paano maiwasan ang malaking pautang nang hindi nakakasira sa suki?',
  'Magkano ang tamang patong / tubo sa Pancit Canton at Softdrinks?',
  'Anong paninda ang mabilis mabenta ngayong tag-init?',
  'Paano ma-compute nang tama ang puhunan at daily profit?',
];

export const SukiChatbot: React.FC<SukiChatbotProps> = ({ isOnline, lang }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      content:
        'Magandang araw Boss! Ako si Suki, ang iyong AI Business Advisor para sa Tindahan Notes. Ano ang maitutulong ko sa iyong sari-sari store ngayon? Pwede mo akong tanungin tungkol sa pautang, patong sa presyo, o paninda tips!',
      timestamp: Date.now(),
    },
  ]);

  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.7-flash');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || input;
    if (!messageText.trim() || isLoading) return;

    if (!isOnline) {
      const offlineMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'model',
        content: `⚠️ ${translate(lang, 'ai_requires_internet')}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() - 1).toString(), role: 'user', content: messageText, timestamp: Date.now() },
        offlineMsg,
      ]);
      setInput('');
      return;
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: historyPayload,
          message: messageText,
          model: selectedModel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const modelMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: data.text || 'Pasensya na boss, subukang magtanong muli.',
          timestamp: Date.now(),
          modelUsed: data.modelUsed || selectedModel,
        };
        setMessages((prev) => [...prev, modelMsg]);
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to fetch AI response');
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: err?.message?.includes('high demand') || err?.message?.includes('503')
          ? 'Medyo mataas ang demand ngayon sa AI server. Paki-pindot muli ang tanong para subukan agad.'
          : 'Nagka-error sa pagsagot ni Suki. Paki-check ang iyong internet connection at subukang muli.',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsLoading(false);
  };

  return (
    <div className="theme-card rounded-3xl shadow-2xs border h-[580px] sm:h-[650px] flex flex-col overflow-hidden transition-colors duration-200">
      {/* Top Header */}
      <div className="theme-bg-header text-white p-3.5 sm:p-4 flex items-center justify-between border-b theme-border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl theme-bg-primary text-white flex items-center justify-center font-bold shadow-2xs border border-white/20">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-white">Suki AI Store Advisor</h3>
            <p className="text-[10px] theme-text-accent font-medium">Taglish Business Assistant for Sari-Sari Stores</p>
          </div>
        </div>

        {/* Model Selector Dropdown */}
        <div className="flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5 theme-text-accent" />
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-white/10 text-white text-[11px] font-bold border border-white/20 rounded-xl px-2 py-1 focus:outline-none"
          >
            <option value="gemini-3.7-flash" className="text-zinc-900 bg-white">Gemini 3.7 Flash (Advisor)</option>
            <option value="gemini-3.1-flash-lite" className="text-zinc-900 bg-white">Gemini 3.1 Flash-Lite (Fast)</option>
            <option value="gemini-3.1-pro-preview" className="text-zinc-900 bg-white">Gemini 3.1 Pro (Deep Analysis)</option>
          </select>
        </div>
      </div>

      {/* Chat Messages Thread */}
      <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 theme-bg-app">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                  isUser ? 'theme-bg-primary text-white' : 'theme-bg-surface-subtle theme-text-accent border theme-border-subtle'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[82%] rounded-3xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-2xs whitespace-pre-wrap ${
                  isUser
                    ? 'theme-bg-primary text-white font-medium rounded-tr-none'
                    : 'theme-card theme-text-app border rounded-tl-none'
                }`}
              >
                {m.content}
                {m.modelUsed && (
                  <span className="block text-[9px] theme-text-secondary mt-1 font-mono">
                    Model: {m.modelUsed}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-bold theme-text-accent p-2.5 theme-bg-surface-subtle rounded-2xl w-fit border theme-border-subtle">
            <RefreshCw className="w-3.5 h-3.5 animate-spin theme-text-primary" />
            <span>Nagiisip si Suki...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Questions Bar */}
      <div className="p-2 theme-bg-surface-subtle border-t theme-border-subtle flex gap-1.5 overflow-x-auto text-[11px] font-medium no-scrollbar">
        <span className="theme-text-secondary font-bold shrink-0 self-center px-1">Tanungin:</span>
        {PRESET_QUESTIONS.map((q, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(q)}
            className="theme-card hover:theme-bg-primary hover:text-white theme-text-app border theme-border-subtle px-3 py-1 rounded-full whitespace-nowrap transition-colors shrink-0 font-medium active:scale-95"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <div className="p-3 theme-card border-t theme-border-subtle">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Itanong kay Suki... (e.g. Magkano ibebenta ang Rebisco?)"
            className="flex-1 theme-input border rounded-2xl py-2.5 px-3.5 text-xs sm:text-sm theme-text-app focus:outline-none font-medium"
          />

          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="theme-bg-primary text-white font-extrabold px-4 py-2.5 rounded-2xl text-xs sm:text-sm flex items-center gap-1.5 disabled:opacity-50 transition-all active:scale-95 shrink-0 shadow-2xs"
          >
            <span>{translate(lang, 'btn_record')}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
