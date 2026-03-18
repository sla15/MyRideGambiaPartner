import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { ChevronLeft, Send, Phone } from 'lucide-react';

export const ChatScreen: React.FC = () => {
  const { activeChat, closeChat, chatMessages, sendMessage } = useApp();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = activeChat ? chatMessages[activeChat.id] || [] : [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!activeChat) return null;

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(activeChat.id, input);
      setInput('');
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-white dark:bg-black flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md pt-safe pb-3 px-4 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
            <button onClick={closeChat} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                <ChevronLeft size={24} className="text-partner-green" />
            </button>
            <div>
                <h2 className="font-bold text-gray-900 dark:text-white">{activeChat.participantName}</h2>
                <p className="text-xs text-gray-500">Online</p>
            </div>
        </div>
        <button className="p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-partner-darkGreen dark:text-partner-green">
            <Phone size={20} fill="currentColor" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-black">
        {messages.map((msg) => {
            const isMe = msg.sender === 'ME';
            return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                        isMe 
                        ? 'bg-partner-green text-black rounded-tr-sm' 
                        : 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-white rounded-tl-sm border border-gray-100 dark:border-zinc-700'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-white dark:bg-zinc-900 border-t border-gray-100 dark:border-zinc-800 shrink-0 pb-safe">
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-800 rounded-full px-4 py-1">
            <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 bg-transparent py-3 text-sm focus:outline-none text-gray-900 dark:text-white"
            />
            <button 
                onClick={handleSend}
                disabled={!input.trim()}
                className={`p-2 rounded-full transition-colors ${input.trim() ? 'bg-partner-green text-black' : 'bg-gray-300 dark:bg-zinc-700 text-gray-500'}`}
            >
                <Send size={16} />
            </button>
        </div>
      </div>
    </div>
  );
};