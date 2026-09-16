// @ts-nocheck
"use client";

import { useState, useRef, useEffect, useCallback, useDeferredValue } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { X, MessageCircle, Send, Sparkles, Plus, Phone, Loader2, CheckCircle2, Paperclip, FileText, Lock, LogIn } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { requestGlobalCallback } from "@/lib/User/user/global-callback";
import { buildAuthHref } from "@/lib/auth/redirect-utils";

function cleanAssistantText(rawText: string): string {
    if (!rawText) return "";
    let text = rawText;
    text = text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '');
    return text.trim();
}

const loadingPhrases = [
    "✦ Honing your request...",
    "⚡ Fetching intelligence...",
    "🔍 Scanning AcademyFind database...",
    "🧠 Synthesizing recommendations...",
    "✨ Framing the perfect answer...",
    "🎯 Aligning neural pathways...",
    "📡 Consulting career algorithms...",
];

const INITIAL_MESSAGE = {
    id: 'initial',
    role: 'assistant' as const,
    parts: [{ type: 'text' as const, text: "Hi! 👋 I'm your **AcademyFind Counselor**.\n\nTell me — what are you looking for?\n- 🏫 **Coaching** for an exam?\n- 🧠 **Career guidance** or aptitude help?\n- 📄 **Resume building**?\n- Or something else entirely?\n\nI'm here to genuinely help you find the right path! 🎯" }]
};

interface AiChatBotProps {
    isAuthenticated?: boolean;
    defaultName?: string | null;
    defaultPhone?: string | null;
}

export default function AiChatBot({ isAuthenticated = false, defaultName, defaultPhone }: AiChatBotProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'callback'>('chat');
    const [input, setInput] = useState("");
    const [loadingText, setLoadingText] = useState(loadingPhrases[0]);
    const [showLoader, setShowLoader] = useState(false);
    const [chatKey, setChatKey] = useState(0);

    // File upload state
    const [attachedFile, setAttachedFile] = useState<{ name: string; content?: string; size: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Callback form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formError, setFormError] = useState("");
    const [currentUrl, setCurrentUrl] = useState("");

    const { messages, sendMessage, append, isLoading, error, setMessages } = useChat({
        api: '/api/v2/counselor',
        id: `counselor-${chatKey}`,
        initialMessages: [INITIAL_MESSAGE],
        onResponse: (response) => {
            console.log("🔥 [useChat onResponse] Status:", response.status, response.statusText);
        },
        onError: (err) => {
            console.error("🔥 [useChat onError]:", err);
        }
    });

    const deferredMessages = useDeferredValue(messages);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
    };

    async function extractTextFromPDFBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
        try {
            if (typeof window !== "undefined") {
                if (!(window as any).pdfjsLib) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement("script");
                        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
                        script.onload = () => {
                            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                            resolve();
                        };
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }
                const pdfjsLib = (window as any).pdfjsLib;
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = "";
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(" ");
                    fullText += pageText + "\n";
                }
                if (fullText.trim().length > 10) {
                    return fullText.trim();
                }
            }
        } catch (e) {
            console.warn("PDF.js extraction failed, falling back to raw parser:", e);
        }

        try {
            const textDecoder = new TextDecoder('utf-8');
            const raw = textDecoder.decode(new Uint8Array(arrayBuffer));
            const words = raw.match(/[A-Za-z0-9@.#+\-]{3,}/g) || [];
            const filterSet = new Set(['obj', 'endobj', 'stream', 'endstream', 'xref', 'trailer', 'startxref', 'Page', 'Catalog', 'Font', 'Encoding', 'Type', 'Subtype']);
            const cleanWords = words.filter(w => !filterSet.has(w) && w.length < 30);
            return cleanWords.slice(0, 400).join(' ');
        } catch {
            return '';
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const sizeFormatted = file.size > 1024 * 1024
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(file.size / 1024)} KB`;

        const reader = new FileReader();

        if (file.type.includes("text") || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
            reader.onload = (event) => {
                const text = event.target?.result as string;
                setAttachedFile({ name: file.name, content: text, size: sizeFormatted });
            };
            reader.readAsText(file);
        } else if (file.name.endsWith(".pdf") || file.type.includes("pdf")) {
            reader.onload = async (event) => {
                const buffer = event.target?.result as ArrayBuffer;
                const extractedText = await extractTextFromPDFBuffer(buffer);
                setAttachedFile({ name: file.name, content: extractedText || undefined, size: sizeFormatted });
            };
            reader.readAsArrayBuffer(file);
        } else {
            setAttachedFile({ name: file.name, size: sizeFormatted });
        }
    };

    const removeAttachedFile = () => {
        setAttachedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const textContent = input.trim();
        if ((!textContent && !attachedFile) || isLoading) return;

        console.log("🚀 [Client AiChatBot] Submitting message:", textContent);
        setShowLoader(true);

        let finalMessage = textContent;
        if (attachedFile) {
            if (attachedFile.content) {
                finalMessage = `[Attached Resume File: ${attachedFile.name}]\n\nResume Content:\n${attachedFile.content}\n\n${textContent ? `User Note: ${textContent}` : 'Please review my resume, highlight flaws, and provide an ATS-optimized version.'}`;
            } else {
                finalMessage = `[Attached Resume Document: ${attachedFile.name}]\n\n${textContent ? `User Details: ${textContent}` : 'Please help me review and build an ATS-optimized resume.'}`;
            }
        }

        try {
            if (typeof append === 'function') {
                console.log("📡 [Client AiChatBot] Calling append to /api/v2/counselor...");
                append({ role: 'user', content: finalMessage });
            } else if (typeof sendMessage === 'function') {
                console.log("📡 [Client AiChatBot] Calling sendMessage to /api/v2/counselor...");
                sendMessage({ text: finalMessage });
            }
        } catch (err) {
            console.error("❌ [Client AiChatBot Error]:", err);
            setShowLoader(false);
        }

        setInput("");
        removeAttachedFile();
    };

    const handleNewChat = useCallback(() => {
        setChatKey(prev => prev + 1);
        setShowLoader(false);
        setInput("");
        setAttachedFile(null);
    }, []);

    // When chatKey changes, reset messages to initial
    useEffect(() => {
        setMessages([INITIAL_MESSAGE]);
    }, [chatKey, setMessages]);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom instantly without smooth thrashing freeze
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "auto" });
        }
    }, [messages, showLoader]);

    // Track when a NEW assistant message arrives → hide loader
    useEffect(() => {
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.role === 'assistant' && lastMsg.id !== 'initial') {
                const rawText = (typeof lastMsg.content === 'string' && lastMsg.content)
                    ? lastMsg.content
                    : (lastMsg.parts?.map((p: any) => p.text || '').join('') || '');
                const cleanText = cleanAssistantText(rawText);
                if (cleanText.length > 0) {
                    setShowLoader(false);
                }
            }
        }
    }, [messages]);

    // Also hide loader when streaming finishes (isLoading transitions true → false)
    const wasLoadingRef = useRef(false);
    useEffect(() => {
        if (isLoading) {
            wasLoadingRef.current = true;
        } else if (wasLoadingRef.current && showLoader) {
            // isLoading just went from true → false
            wasLoadingRef.current = false;
            setShowLoader(false);
        }
    }, [isLoading, showLoader]);

    // Stop loader on error
    useEffect(() => {
        if (error) {
            setShowLoader(false);
        }
    }, [error]);

    // Safety timeout — never show loader for more than 30s
    useEffect(() => {
        if (showLoader) {
            const timeout = setTimeout(() => setShowLoader(false), 30000);
            return () => clearTimeout(timeout);
        }
    }, [showLoader]);

    // Cycle through loading phrases
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showLoader) {
            let i = 0;
            setLoadingText(loadingPhrases[0]);
            interval = setInterval(() => {
                i = (i + 1) % loadingPhrases.length;
                setLoadingText(loadingPhrases[i]);
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [showLoader]);

    // Capture URL for callback form
    useEffect(() => {
        if (isOpen && activeTab === 'callback') {
            setCurrentUrl(window.location.href);
        }
    }, [isOpen, activeTab]);

    // Reset callback form when tab switches away
    useEffect(() => {
        if (activeTab === 'chat') {
            setTimeout(() => {
                setIsSuccess(false);
                setFormError("");
            }, 300);
        }
    }, [activeTab]);

    const handleCallbackSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError("");

        const formData = new FormData(e.currentTarget);
        formData.append("sourceUrl", currentUrl || window.location.href);

        const res = await requestGlobalCallback(formData);
        if (res.success) {
            setIsSuccess(true);
        } else {
            setFormError(res.error || "Failed to submit.");
        }
        setIsSubmitting(false);
    };

    return (
        <div className="fixed bottom-3 right-3 md:bottom-6 md:right-6 z-[102]">
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <PopoverTrigger asChild>
                    <button
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white rounded-full px-4 py-3 md:px-5 md:py-3 shadow-2xl shadow-amber-200/50 hover:scale-105 transition-all duration-300 group"
                    >
                        <div className="relative">
                            {isOpen ? <X className="w-5 h-5" /> : <Sparkles className="w-5 h-5 animate-pulse" />}
                            {!isOpen && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
                                </span>
                            )}
                        </div>
                        <span className="text-xs md:text-sm font-extrabold tracking-wide">
                            {isOpen ? "Close" : "AI Counselor"}
                        </span>
                    </button>
                </PopoverTrigger>

                <PopoverContent
                    side="top"
                    align="end"
                    sideOffset={12}
                    collisionPadding={{ left: 12, right: 12, top: 12, bottom: 12 }}
                    className="w-[calc(100vw-24px)] sm:w-[360px] z-[100] rounded-3xl p-0 overflow-hidden shadow-2xl shadow-amber-100/50 border border-amber-200 origin-bottom-right animate-in zoom-in-95 duration-200 flex flex-col h-[520px] max-h-[80vh]"
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-amber-400 to-amber-500 p-4 text-white relative shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold tracking-tight text-sm">AcademyFind Counselor</h3>
                                    <p className="text-amber-100 text-[10px] flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
                                        Expert Counselor · Online
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {activeTab === 'chat' && (
                                    <button
                                        onClick={handleNewChat}
                                        title="New Chat"
                                        className="p-1.5 rounded-full hover:bg-amber-600/50 transition-colors"
                                    >
                                        <Plus className="w-5 h-5 text-white" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-full hover:bg-amber-600/50 transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tab Bar */}
                    <div className="bg-amber-50/80 px-3 py-2 border-b border-amber-100 shrink-0">
                        <div className="flex bg-amber-100/60 p-1 rounded-2xl gap-1">
                            <button
                                onClick={() => setActiveTab('chat')}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 ${activeTab === 'chat'
                                        ? 'bg-white text-amber-600 shadow-sm font-extrabold'
                                        : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Chat
                            </button>
                            <button
                                onClick={() => setActiveTab('callback')}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all duration-200 ${activeTab === 'callback'
                                        ? 'bg-white text-amber-600 shadow-sm font-extrabold'
                                        : 'text-slate-500 hover:text-slate-800'
                                    }`}
                            >
                                <Phone className="w-3.5 h-3.5" />
                                Talk to Expert
                            </button>
                        </div>
                    </div>

                    {/* ===== CHAT TAB ===== */}
                    {activeTab === 'chat' && (
                        !isAuthenticated ? (
                            <div className="flex-1 px-5 py-6 bg-gradient-to-b from-amber-50/80 via-white to-amber-50/40 flex flex-col items-center justify-start overflow-y-auto">
                                {/* Glowing Icon Badge */}
                                <div className="relative mt-2 mb-4 shrink-0">
                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-amber-300/50">
                                        <Sparkles className="w-8 h-8 animate-pulse" />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-slate-900 text-white p-1 rounded-full shadow-md border border-white">
                                        <Lock className="w-3 h-3" />
                                    </div>
                                </div>

                                {/* Headline */}
                                <h3 className="text-lg font-extrabold text-slate-900 mb-1.5 tracking-tight">
                                    Unlock Your AI Counselor
                                </h3>

                                <p className="text-xs text-slate-600 mb-5 leading-relaxed max-w-[250px]">
                                    Sign in to chat with your AI Counselor, get ATS resume reviews, and personalized career roadmaps!
                                </p>

                                {/* Feature Pills */}
                                <div className="w-full space-y-2 mb-5 text-left">
                                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-amber-100/80 shadow-xs text-xs font-medium text-slate-700">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                        <span>🎯 Personal Career Counseling</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-amber-100/80 shadow-xs text-xs font-medium text-slate-700">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                        <span>📄 ATS Resume Review & Building</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white border border-amber-100/80 shadow-xs text-xs font-medium text-slate-700">
                                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                                        <span>🏫 Coaching Institute Finder</span>
                                    </div>
                                </div>

                                {/* Login CTA Button */}
                                <Link
                                    href={buildAuthHref("/login", pathname)}
                                    className="w-full py-3 px-5 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-amber-300/40 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <LogIn className="w-4 h-4" />
                                    Sign In to Start Chatting
                                </Link>

                                <p className="mt-3 text-[11px] text-slate-400">
                                    New to AcademyFind? <Link href={buildAuthHref("/register", pathname)} className="text-amber-600 font-semibold hover:underline">Create an account</Link>
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Chat Messages */}
                                <div className="flex-1 p-4 bg-amber-50/30 overflow-y-auto flex flex-col gap-4">

                                    {deferredMessages.map((m) => {
                                        const rawText = (typeof m.content === 'string' && m.content)
                                            ? m.content
                                            : (m.parts?.map((p: any) => p.text || '').join('') || '');

                                        const cleanText = m.role === 'assistant'
                                            ? cleanAssistantText(rawText)
                                            : rawText.trim();

                                        if (m.role === 'assistant' && cleanText.length === 0) return null;

                                        return (
                                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm break-words overflow-hidden ${m.role === 'user'
                                                    ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white rounded-br-none whitespace-pre-wrap'
                                                    : 'bg-white border border-amber-100 text-slate-800 rounded-bl-none shadow-sm'
                                                    }`}>
                                                    {m.role === 'user' ? (
                                                        <span className="whitespace-pre-wrap">{cleanText}</span>
                                                    ) : (
                                                        <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:p-0">
                                                            <ReactMarkdown
                                                                remarkPlugins={[remarkGfm]}
                                                                components={{
                                                                    a: ({ href, children }) => (
                                                                        <Link href={href || "#"} className="font-semibold text-amber-600 hover:text-amber-800 underline decoration-amber-300 underline-offset-2 break-all">
                                                                            {children}
                                                                        </Link>
                                                                    ),
                                                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                                                    li: ({ children }) => <li>{children}</li>,
                                                                    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                                                                    table: ({ children }) => (
                                                                        <div className="overflow-x-auto my-3 rounded-xl border border-amber-200 shadow-xs bg-white">
                                                                            <table className="w-full text-xs text-left border-collapse">{children}</table>
                                                                        </div>
                                                                    ),
                                                                    thead: ({ children }) => <thead className="bg-amber-100/80 text-amber-900 font-bold">{children}</thead>,
                                                                    th: ({ children }) => <th className="px-3 py-2 border-b border-r border-amber-200 last:border-r-0 font-bold">{children}</th>,
                                                                    td: ({ children }) => <td className="px-3 py-2 border-b border-r border-amber-100 last:border-r-0 text-slate-700">{children}</td>,
                                                                    tr: ({ children }) => <tr className="even:bg-amber-50/40 hover:bg-amber-50/80 transition-colors">{children}</tr>
                                                                }}
                                                            >
                                                                {cleanText}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Error state */}
                                    {error && !showLoader && (
                                        <div className="flex justify-start">
                                            <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm text-sm max-w-[90%]">
                                                ⚠️ Something went wrong. Please try again.
                                            </div>
                                        </div>
                                    )}

                                    {/* Loading Animation */}
                                    {showLoader && (
                                        <div className="flex justify-start">
                                            <div className="bg-white border border-amber-100 text-slate-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm max-w-[90%]">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                                                    </div>
                                                    <span
                                                        key={loadingText}
                                                        className="text-xs font-medium tracking-wide text-slate-600"
                                                        style={{
                                                            animation: 'fadeSlide 0.4s ease-out'
                                                        }}
                                                    >
                                                        {loadingText}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1 mt-2">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ animation: 'dotBounce 1.2s infinite ease-in-out' }} />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ animation: 'dotBounce 1.2s infinite ease-in-out 0.15s' }} />
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ animation: 'dotBounce 1.2s infinite ease-in-out 0.3s' }} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Inline keyframes */}
                                <style jsx global>{`
                                @keyframes fadeSlide {
                                    from { opacity: 0; transform: translateY(4px); }
                                    to { opacity: 1; transform: translateY(0); }
                                }
                                @keyframes dotBounce {
                                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                                    40% { transform: scale(1); opacity: 1; }
                                }
                            `}</style>

                                {/* Input Area */}
                                <div className="p-3 bg-white border-t border-amber-100 shrink-0">
                                    {/* Attached file preview badge */}
                                    {attachedFile && (
                                        <div className="mb-2 flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-xs text-amber-800 animate-in fade-in slide-in-from-bottom-1">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span className="font-semibold truncate">{attachedFile.name}</span>
                                                <span className="text-[10px] text-amber-600/70">({attachedFile.size})</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={removeAttachedFile}
                                                className="p-1 hover:bg-amber-200/50 rounded-full text-amber-700 transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit} className="flex gap-1.5 sm:gap-2 items-center w-full min-w-0">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept=".pdf,.doc,.docx,.txt,.md"
                                            className="hidden"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            title="Upload Resume (.pdf, .doc, .txt)"
                                            className="p-2 sm:p-2.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200/60 transition-colors shrink-0 flex items-center justify-center"
                                        >
                                            <Paperclip className="w-4 h-4" />
                                        </button>

                                        <input
                                            value={input || ""}
                                            onChange={handleInputChange}
                                            placeholder={attachedFile ? "Add a message..." : "Type message or upload..."}
                                            className="flex-1 min-w-0 bg-amber-50 rounded-full px-3.5 py-2 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-amber-400/30 focus:bg-white border border-transparent focus:border-amber-400/40 transition-all"
                                        />
                                        <Button
                                            type="submit"
                                            disabled={showLoader || isLoading || (!input.trim() && !attachedFile)}
                                            size="icon"
                                            className="rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-white shrink-0 shadow-sm"
                                        >
                                            <Send className="w-4 h-4" />
                                        </Button>
                                    </form>
                                </div>
                            </>
                        ))}

                    {/* ===== CALLBACK TAB ===== */}
                    {activeTab === 'callback' && (
                        <div className="flex-1 overflow-y-auto">
                            {/* Callback Header */}
                            <div className="p-5 text-center bg-gradient-to-b from-amber-50 to-white">
                                <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                    <Phone className="w-7 h-7 text-amber-600" />
                                </div>
                                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Need Expert Help?</h3>
                                <p className="text-slate-500 mt-1 text-xs leading-snug max-w-[240px] mx-auto">
                                    Leave your details and our expert counselors will call you back shortly.
                                </p>
                            </div>

                            <div className="px-5 pb-5">
                                {isSuccess ? (
                                    <div className="text-center py-6 animate-in zoom-in duration-300">
                                        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                                        <h4 className="font-bold text-slate-800 text-lg">Request Sent!</h4>
                                        <p className="text-slate-500 text-sm mt-1">We will get back to you within 24 hours.</p>

                                        <div className="mt-6 pt-6 border-t border-slate-100">
                                            <p className="text-sm font-medium text-slate-600 mb-3">Want to explore on your own?</p>
                                            <Link href={buildAuthHref("/login", pathname)} onClick={() => setIsOpen(false)}>
                                                <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl">
                                                    Login / Sign Up
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleCallbackSubmit} className="space-y-4">
                                        {formError && <div className="text-xs text-red-500 bg-red-50 p-3 rounded-xl border border-red-100">{formError}</div>}

                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Name *</label>
                                                <input
                                                    required
                                                    type="text"
                                                    name="name"
                                                    placeholder="Rahul Kumar"
                                                    defaultValue={defaultName || ""}
                                                    className="w-full mt-1 p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mobile Number *</label>
                                                <input
                                                    required
                                                    type="tel"
                                                    name="phone"
                                                    pattern="[0-9]{10}"
                                                    title="Please enter a valid 10-digit mobile number"
                                                    placeholder="+91 98765 43210"
                                                    defaultValue={defaultPhone || ""}
                                                    className="w-full mt-1 p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Message <span className="text-slate-400 normal-case">(optional)</span></label>
                                                <textarea
                                                    name="message"
                                                    rows={3}
                                                    placeholder="Tell us what you need help with... (optional)"
                                                    className="w-full mt-1 p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white transition-all resize-none"
                                                />
                                            </div>
                                        </div>

                                        <Button disabled={isSubmitting} type="submit" className="w-full bg-amber-400 hover:bg-amber-500 text-white py-5 mt-2 rounded-xl font-bold">
                                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Request Callback"}
                                        </Button>
                                        <p className="text-[10px] text-center text-slate-400 mt-2">By submitting, you agree to our Privacy Policy.</p>
                                    </form>
                                )}
                            </div>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </div>
    );
}
