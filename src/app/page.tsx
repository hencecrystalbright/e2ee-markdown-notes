"use client";

import { useState, useEffect, useRef } from 'react';
import { SessionProvider, useSession, signOut } from "next-auth/react";
import {
  Plus,
  FileText,
  Lock,
  Unlock,
  Trash2,
  Search,
  ShieldAlert,
  KeyRound,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
  Camera,
  FileCode,
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Menu,
  X,
  LogOut,
  Bot,
  Send,
  Sparkles,
  Loader2,
  Smile,
  Briefcase,
  Languages,
  ListTree,
  Sliders,
  Power,
  Tag as TagIcon,
  Copy,
  Check,
  Key,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { encryptText, decryptText } from "@/lib/crypto";

// 匯入 Markdown 渲染套件
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

// 匯入 Word 轉 Markdown 套件
import mammoth from 'mammoth';
import TurndownService from 'turndown';

interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
  isEncrypted: boolean;
  tags?: string[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function NoteApp() {
  const { data: session, status } = useSession();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [textColor, setTextColor] = useState("#ef4444");

  // 模式 State：編輯 (edit) 與 預覽 (preview)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  // RWD 與工具箱 State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // 🏷️ Tag 控制列動態折疊 State
  const [isTagSectionOpen, setIsTagSectionOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // --- AI 開關與 Chatbox 相關 State ---
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm TurtleAI assistant 🐢。請開啟工具列右側的 AI 安全開關，即可點擊頂部圖示幫你摘要、潤飾或翻譯喔！" }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lastSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

  // 未登入自動重導向
  useEffect(() => {
    if (status === "unauthenticated") {
      window.location.href = "/login";
    }
  }, [status]);

  // 聊天訊息自動滾動到底部
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isAiThinking]);

  useEffect(() => {
    const fetchNotes = async () => {
      try {
        const response = await fetch('/api/notes');
        if (response.ok) {
          const data = await response.json();
          setNotes(data);
          setActiveNoteId((prevId) => {
            if (!prevId && data.length > 0) return data[0].id;
            return prevId;
          });
        }
      } catch (error) {
        console.error("載入筆記失敗:", error);
      }
    };

    if (status === "authenticated") {
      fetchNotes();
    }
  }, [status]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  // 拆分標題與內文 Helper (無值時維持空字串)
  const getNoteTitleAndBody = (note?: Note) => {
    if (!note) return { title: "", body: "" };
    if (!note.isEncrypted) {
      const parts = note.content.split("\n");
      const title = parts[0]?.replace(/^#*\s*/, "") || note.title || "";
      const body = parts.slice(1).join("\n");
      return { title, body };
    }

    if (!passphrase) {
      return { title: note.title || "", body: "🔒 內容已加密，請在左側輸入金鑰以解密檢視。" };
    }

    const decrypted = decryptText(note.content, passphrase);
    const parts = decrypted.split("\n");
    const title = parts[0] !== undefined ? parts[0].replace(/^#*\s*/, "") : (note.title || "");
    const body = parts.slice(1).join("\n");
    return { title, body };
  };

  // 建立新筆記 (標題純空字串)
  const handleCreateNote = async () => {
    const newNoteData = {
      title: "",
      content: "",
      isEncrypted: false,
      tags: [],
    };

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNoteData),
      });

      if (response.ok) {
        const savedNote = await response.json();
        setNotes((prev) => [savedNote, ...prev]);
        setActiveNoteId(savedNote.id);
        setIsSidebarOpen(false);
      } else {
        const errText = await response.text();
        alert(`建立筆記失敗 (${response.status}): ${errText}`);
      }
    } catch (error) {
      console.error("新增筆記失敗:", error);
      alert(`連線錯誤: ${error}`);
    }
  };

  // 組合標題與內文並更新後端
  const handleSaveNoteData = async (newTitle: string, newBody: string, updatedTags?: string[]) => {
    if (!activeNote) return;

    const fullRawText = `${newTitle}\n${newBody}`;
    const titleForDb = newTitle.trim();

    const finalContent = activeNote.isEncrypted && passphrase
      ? encryptText(fullRawText, passphrase)
      : fullRawText;

    const finalTags = updatedTags !== undefined ? updatedTags : (activeNote.tags || []);

    const updatedNoteData = {
      ...activeNote,
      title: titleForDb,
      content: finalContent,
      tags: finalTags,
      updatedAt: new Date().toISOString().split("T")[0],
    };

    setNotes((prevNotes) =>
      prevNotes.map((n) => (n.id === activeNoteId ? updatedNoteData : n))
    );

    try {
      await fetch(`/api/notes/${activeNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedNoteData),
      });
    } catch (error) {
      console.error("更新筆記失敗:", error);
    }
  };

  // --- Tag 新增與移除邏輯 ---
  const handleAddTag = (tagToAdd: string) => {
    if (!activeNote) return;
    const cleanTag = tagToAdd.trim().replace(/^#/, "");
    if (!cleanTag) return;

    const { title, body } = getNoteTitleAndBody(activeNote);
    const currentTags = activeNote.tags || [];
    if (!currentTags.includes(cleanTag)) {
      const newTags = [...currentTags, cleanTag];
      handleSaveNoteData(title, body, newTags);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeNote) return;
    const { title, body } = getNoteTitleAndBody(activeNote);
    const currentTags = activeNote.tags || [];
    const newTags = currentTags.filter((t) => t !== tagToRemove);
    handleSaveNoteData(title, body, newTags);
  };


  // 🛡️ 一鍵複製與 30 秒自動清空剪貼簿機制
  const handleCopySecureText = (text: string, keyIdentifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyIdentifier);

    setTimeout(() => {
      navigator.clipboard.writeText("");
      setCopiedKey(null);
    }, 30000);
  };

  const toggleEncryption = async () => {
    if (!activeNote) return;

    if (!passphrase) {
      alert("請先在左側輸入加密金鑰！");
      return;
    }

    const { title, body } = getNoteTitleAndBody(activeNote);
    const fullText = `${title}\n${body}`;
    const nextEncryptedState = !activeNote.isEncrypted;

    const newContent = nextEncryptedState
      ? encryptText(fullText, passphrase)
      : fullText;

    const updatedNoteData = {
      ...activeNote,
      isEncrypted: nextEncryptedState,
      content: newContent,
    };

    setNotes((prev) =>
      prev.map((n) => (n.id === activeNoteId ? updatedNoteData : n))
    );

    try {
      await fetch(`/api/notes/${activeNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedNoteData),
      });
    } catch (error) {
      console.error("切換加密狀態失敗:", error);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm("確定要刪除這份筆記嗎？")) return;

    try {
      const response = await fetch(`/api/notes/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const remainingNotes = notes.filter((n) => n.id !== id);
        setNotes(remainingNotes);
        if (activeNoteId === id) {
          setActiveNoteId(remainingNotes[0]?.id || "");
        }
      }
    } catch (error) {
      console.error("刪除筆記失敗:", error);
    }
  };

  // --- 發送 AI 訊息 ---
  const handleSendAiMessage = async (overridePrompt?: string) => {
    if (!isAiEnabled) {
      alert("⚠️ AI 功能目前處於【關閉/保密狀態】。請先點擊工具列右側的『 AI 開關 』圖示以啟用。");
      return;
    }

    const messageToSend = overridePrompt || inputMessage;
    if (!messageToSend.trim() || isAiThinking) return;

    const userMsg: ChatMessage = { role: 'user', content: messageToSend };
    const newHistory = [...chatMessages, userMsg];

    setChatMessages(newHistory);
    if (!overridePrompt) setInputMessage("");
    setIsAiThinking(true);
    if (!isChatOpen) setIsChatOpen(true);

    try {
      const { title, body } = getNoteTitleAndBody(activeNote);
      const currentNoteText = `${title}\n${body}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory,
          noteContext: currentNoteText,
        }),
      });

      const data = await res.json();

      if (res.ok && data.reply) {
        setChatMessages([...newHistory, { role: 'assistant', content: data.reply }]);
      } else {
        if (res.status === 429) {
          setIsAiEnabled(false);
        }
        setChatMessages([...newHistory, { role: 'assistant', content: data.error || '❌ AI 回應失敗，請稍後再試。' }]);
      }
    } catch (err) {
      setChatMessages([...newHistory, { role: 'assistant', content: '❌ 連線失敗，請檢查網路狀態。' }]);
    } finally {
      setIsAiThinking(false);
    }
  };

  const updateSelection = () => {
    if (textareaRef.current) {
      lastSelectionRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  };

  const insertFormatting = (prefix: string, suffix: string = "", defaultText: string = "") => {
    if (!textareaRef.current || !activeNote) return;

    const textarea = textareaRef.current;
    const start = lastSelectionRef.current.start;
    const end = lastSelectionRef.current.end;
    const { title, body } = getNoteTitleAndBody(activeNote);

    const selectedText = body.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newBody =
      body.substring(0, start) +
      replacement +
      body.substring(end);

    handleSaveNoteData(title, newBody);

    const newCursorPos = start + replacement.length;

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      lastSelectionRef.current = { start: newCursorPos, end: newCursorPos };
    }, 0);
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const importedText = event.target?.result as string;
      insertFormatting(`\n${importedText}\n`, "", "");
    };
    reader.readAsText(file);
    e.target.value = '';
    setIsFabOpen(false);
  };

  const handleImportWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
      });
      const markdown = turndownService.turndown(html);

      insertFormatting(`\n${markdown}\n`, "", "");
    } catch (error) {
      console.error("Word 檔案解析失敗:", error);
      alert("解析 Word 檔案失敗，請確保這是標準的 .docx 格式檔案。");
    }

    e.target.value = '';
    setIsFabOpen(false);
  };

  const handleInsertImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;

    const loadingPlaceholder = `\n![⏳ 圖片壓縮與上傳中...: ${file.name}]()\n`;
    insertFormatting(loadingPlaceholder, "", "");

    try {
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (event) => {
          img.src = event.target?.result as string;
        };
        reader.onerror = (err) => reject(err);

        img.onload = () => {
          const maxWidth = 1920;
          const maxHeight = 1920;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error("Canvas context is null"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Canvas toBlob failed"));
            },
            'image/jpeg',
            0.8
          );
        };

        reader.readAsDataURL(file);
      });

      const formData = new FormData();
      formData.append('image', compressedBlob, `${file.name.split('.')[0]}.jpg`);

      const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
          Authorization: 'Client-ID 546c25a59c58ad7',
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data?.link) {
        const imageUrl = data.data.link;
        const finalImageTag = `\n![${file.name}](${imageUrl})\n`;

        const { title, body } = getNoteTitleAndBody(activeNote);
        const newBody = body.includes(loadingPlaceholder.trim())
          ? body.replace(loadingPlaceholder.trim(), finalImageTag.trim())
          : `${body}\n${finalImageTag}`;

        handleSaveNoteData(title, newBody);
      } else {
        alert("圖片上傳失敗，請稍後再試！");
      }
    } catch (error) {
      console.error("圖片壓縮/上傳失敗:", error);
      alert("圖片處理異常，請檢查檔案格式。");
    }

    e.target.value = '';
    setIsFabOpen(false);
  };

  const allTags = Array.from(
    new Set(notes.flatMap((n) => n.tags || []))
  );

  const activeNoteData = getNoteTitleAndBody(activeNote);

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans relative">

      {/* 手機版遮罩 Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 側邊欄 Sidebar */}
      <aside className={`
        fixed md:static top-0 left-0 h-full w-72 bg-neutral-900 z-30
        border-r border-neutral-800 flex flex-col transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="p-4 border-b border-neutral-800 space-y-3">

          {/* 側邊欄 Header：登出鈕位於最左邊 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-lg text-neutral-100">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
                title="登出帳號"
              >
                <LogOut className="w-4 h-4" />
              </button>

              <img src="/turtle.svg" alt="Turtle Logo" className="w-6 h-6 object-contain" />
              <span>TurtleNote</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleCreateNote}
                className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                title="新增筆記"
              >
                <Plus className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 md:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {session?.user && (
            <div className="text-[11px] text-neutral-400 bg-neutral-950/60 px-2.5 py-1 rounded-md border border-neutral-800/80 truncate">
              👤 登入者：<span className="text-emerald-400 font-medium">{session.user.name || session.user.email}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] text-neutral-400 flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-emerald-400" />
              主加密金鑰 (Passphrase)
            </label>
            <div className="relative">
              <input
                type={showPassphrase ? "text" : "password"}
                placeholder="輸入解密/加密密碼..."
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-neutral-950 border border-neutral-700 rounded-md focus:outline-none focus:border-emerald-500 text-neutral-200 placeholder-neutral-500"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2.5 top-2 text-neutral-400 hover:text-neutral-200"
              >
                {showPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="搜尋筆記..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-md focus:outline-none focus:border-neutral-600 text-neutral-200 placeholder-neutral-500"
            />
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
          </div>

          {/* 🏷️ 側邊欄 Tag 標籤動態過濾膠囊 */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
              <button
                onClick={() => setSelectedTagFilter(null)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors shrink-0 ${selectedTagFilter === null
                  ? "bg-emerald-600 text-white"
                  : "bg-neutral-950 text-neutral-400 hover:text-neutral-200"
                  }`}
              >
                全部
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTagFilter(selectedTagFilter === tag ? null : tag)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors shrink-0 ${selectedTagFilter === tag
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800"
                    }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/50">
          {notes
            .filter((n) => {
              if (selectedTagFilter !== null && (!n.tags || !n.tags.includes(selectedTagFilter))) {
                return false;
              }
              if (!searchTerm.trim()) return true;

              const term = searchTerm.toLowerCase();
              const titleMatch = n.title.toLowerCase().includes(term);
              const tagMatch = n.tags?.some((t) => t.toLowerCase().includes(term));

              const noteData = getNoteTitleAndBody(n);
              const fullContent = `${noteData.title}\n${noteData.body}`.toLowerCase();
              const contentMatch = fullContent.includes(term);

              return titleMatch || tagMatch || contentMatch;
            })
            .map((note) => (
              <div
                key={note.id}
                onClick={() => {
                  setActiveNoteId(note.id);
                  setIsSidebarOpen(false);
                }}
                className={`p-3.5 cursor-pointer transition-colors ${activeNoteId === note.id
                  ? "bg-neutral-800/80 text-white"
                  : "hover:bg-neutral-800/40 text-neutral-400"
                  }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm truncate text-neutral-200">
                    {note.title || "Untitled Note"}
                  </span>
                  {note.isEncrypted ? (
                    <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
                  )}
                </div>

                {note.tags && note.tags.length > 0 && (
                  <div className="flex items-center gap-1 mb-1.5 flex-wrap">
                    {note.tags.map((t) => (
                      <span key={t} className="px-1.5 py-0.2 rounded bg-neutral-950 border border-neutral-800 text-[9px] text-emerald-400 font-mono">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-neutral-500">
                  <span>{note.updatedAt}</span>
                  <span className="truncate max-w-[100px] font-mono text-[10px]">
                    {note.isEncrypted ? "AES-256 加密中" : note.content.slice(0, 15)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </aside>

      {/* 主編輯區域 */}
      <main className="flex-1 flex flex-col h-full bg-neutral-950 min-w-0">
        {activeNote ? (
          <>
            <header className="h-14 border-b border-neutral-800 px-4 flex items-center justify-between bg-neutral-900/30 shrink-0 gap-2">
              <div className="flex items-center gap-2.5 truncate shrink-0">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 md:hidden"
                  title="開啟筆記清單"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                <span className="font-medium text-sm text-neutral-300 truncate max-w-[100px] sm:max-w-[180px]">
                  {activeNoteData.title || "Untitled Note"}
                </span>
              </div>

              {/* 🤖 頂部 AI 快捷圖示選單 */}
              <div className={`flex items-center gap-1 overflow-x-auto scrollbar-none py-1 border-l border-r border-neutral-800/80 px-2 transition-opacity ${!isAiEnabled ? "opacity-30 pointer-events-none" : "opacity-100"
                }`}>
                <button
                  onClick={() => handleSendAiMessage("請幫我提煉這篇筆記的核心重點與摘要。")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-500/60 text-indigo-400 hover:bg-indigo-900/80 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Summary"
                >
                  <Sparkles className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage("請用通俗易懂、簡潔白話的語言重新表達這篇筆記。")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Simple"
                >
                  <Smile className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage("請把這篇筆記轉化為商務、嚴謹、專業的報告口吻。")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-amber-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Pro"
                >
                  <Briefcase className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage("請將這篇筆記內容流暢翻譯為英文版本，並保持原本的 Markdown 格式。")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-blue-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="ENG"
                >
                  <Languages className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage("請將這篇筆記內文拆解為結構清晰的大綱架構 (Headings & Bullets)。")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-purple-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Outline"
                >
                  <ListTree className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage("請幫我檢查這篇筆記的錯別字與語法流暢度。")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Edited 1"
                >
                  <Sliders className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage("請幫我提出根據這篇筆記可執行的後續行動與建議。")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Edited 2"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              </div>

              {/* 加密 & 刪除按鈕 */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={toggleEncryption}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors shrink-0 ${activeNote.isEncrypted
                    ? "bg-emerald-950/80 border border-emerald-600 text-emerald-400 hover:bg-emerald-900/50"
                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                    }`}
                >
                  {activeNote.isEncrypted ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">已加密</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span className="hidden lg:inline">未加密</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDeleteNote(activeNote.id)}
                  className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-md transition-colors"
                  title="刪除筆記"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </header>

            <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3 relative">

              {/* 🏷️ 動態折疊 Tag 標籤控制列 */}
              {isTagSectionOpen && (
                <div className="p-2.5 bg-neutral-900/90 border border-neutral-800 rounded-lg flex flex-col gap-2 shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <TagIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />

                    {activeNote.tags?.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-[11px] font-mono"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }}
                      className="inline-flex items-center"
                    >
                      <input
                        type="text"
                        placeholder="+ 自訂 Tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        className="bg-neutral-950 border border-neutral-800 rounded-md px-2 py-0.5 text-[11px] text-neutral-200 focus:outline-none focus:border-emerald-500 w-24"
                      />
                    </form>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-neutral-800/60 text-[11px]">
                    <span className="text-neutral-500 text-[10px] shrink-0"></span>

                    <button
                      type="button"
                      onClick={() => handleAddTag("Password")}
                      className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors shrink-0"
                    >
                      🔑 #Password
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddTag("AuthKey")}
                      className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors shrink-0"
                    >
                      ⚡ #AuthKey
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddTag("SSH_Key")}
                      className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors shrink-0"
                    >
                      🛡️ #SSH_Key
                    </button>

                    
                  </div>
                </div>
              )}

              {/* 格式工具列 */}
              <div className="flex items-center gap-1 p-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-300 overflow-x-auto shrink-0 scrollbar-none">

                <button
                  type="button"
                  onClick={() => insertFormatting("**", "**", "粗體文字")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40 shrink-0"
                  title="粗體"
                >
                  <Bold className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting("*", "*", "斜體文字")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40 shrink-0"
                  title="斜體"
                >
                  <Italic className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting("~~", "~~", "刪除線文字")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40 shrink-0"
                  title="刪除線"
                >
                  <Strikethrough className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting("<mark>", "</mark>", "高亮文字")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-amber-300 rounded transition disabled:opacity-40 shrink-0"
                  title="高亮"
                >
                  <Highlighter className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-4 bg-neutral-800 mx-1 shrink-0" />

                <div className="relative flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => colorInputRef.current?.click()}
                    disabled={activeNote.isEncrypted && !passphrase}
                    className="p-1.5 hover:bg-neutral-800 rounded transition flex items-center gap-1 disabled:opacity-40"
                    title="選取文字顏色"
                  >
                    <Palette className="w-4 h-4" style={{ color: textColor }} />
                  </button>
                  <input
                    type="color"
                    ref={colorInputRef}
                    value={textColor}
                    onChange={(e) => {
                      setTextColor(e.target.value);
                      insertFormatting(`<span style="color: ${e.target.value}">`, "</span>", "彩色文字");
                    }}
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                  />
                </div>

                <div className="w-[1px] h-4 bg-neutral-800 mx-1 shrink-0" />

                <button
                  type="button"
                  onClick={() => insertFormatting('\n<div align="left">\n', '\n</div>\n', '向左對齊內容')}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40 shrink-0"
                  title="向左對齊"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting('\n<div align="center">\n', '\n</div>\n', '置中對齊內容')}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40 shrink-0"
                  title="置中對齊"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting('\n<div align="right">\n', '\n</div>\n', '向右對齊內容')}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40 shrink-0"
                  title="向右對齊"
                >
                  <AlignRight className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-4 bg-neutral-800 mx-1 shrink-0" />

                {/* 🏷️ Tag 標籤動態折疊按鈕 */}
                <button
                  type="button"
                  onClick={() => setIsTagSectionOpen(!isTagSectionOpen)}
                  className={`px-2 py-1 rounded-md transition-all flex items-center gap-1 text-xs shrink-0 font-medium ${isTagSectionOpen
                    ? "bg-emerald-950 border border-emerald-600 text-emerald-300"
                    : (activeNote.tags && activeNote.tags.length > 0)
                      ? "bg-neutral-800 text-emerald-400 border border-emerald-500/40"
                      : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                  title={isTagSectionOpen ? "點擊收合 Tag 面板" : "點擊展開 Tag 面板"}
                >
                  <TagIcon className="w-3.5 h-3.5" />
                  <span>
                    Tag {activeNote.tags && activeNote.tags.length > 0 ? `(${activeNote.tags.length})` : ''}
                  </span>
                  {isTagSectionOpen ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                </button>

                <div className="w-[1px] h-4 bg-neutral-800 mx-1 shrink-0" />

                <button
                  type="button"
                  onClick={() => insertFormatting("\n\nURL: \n\nAccount: ", "\n\nSecret: \n\n", "")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="px-2 py-1 bg-amber-950/80 border border-amber-600/80 text-amber-300 hover:bg-amber-900/80 rounded transition flex items-center gap-1 text-xs shrink-0 font-medium disabled:opacity-40"
                  title="插入結構化帳號密碼範本"
                >
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Sercet</span>
                </button>

                {/* 🛡️ AI 保密/啟用安全開關 */}
                <button
                  type="button"
                  onClick={() => setIsAiEnabled(!isAiEnabled)}
                  className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 text-xs font-semibold shrink-0 shadow-sm ${isAiEnabled
                    ? "bg-emerald-600 text-white shadow-emerald-950/50"
                    : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
                    }`}
                  title={isAiEnabled ? "AI 功能【已啟用】：筆記解密內文可供 AI 提問分析" : "AI 功能【已關閉】：保護機密，禁止任何筆記傳送至 AI"}
                >
                  <Power className={`w-3.5 h-3.5 ${isAiEnabled ? "text-white" : "text-neutral-500"}`} />
                  <span>AI {isAiEnabled ? "ON" : "OFF"}</span>
                </button>
              </div>

              {/* 編輯器 / 預覽器 切換顯示區域 */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {viewMode === 'edit' ? (
                  <div className="flex flex-col gap-3 min-h-full pb-30">

                    {/* 🟠 1. 獨立橘框標題列：Placeholder 完全依據要求精準呈現！ */}
                    <div className="relative shrink-0">
                      <input
                        ref={titleInputRef}
                        type="text"
                        value={activeNoteData.title}
                        onChange={(e) => handleSaveNoteData(e.target.value, activeNoteData.body)}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab' && !e.shiftKey) {
                            e.preventDefault();
                            textareaRef.current?.focus();
                          }
                        }}
                        disabled={activeNote.isEncrypted && !passphrase}
                        placeholder="筆記標題（不加密，僅供搜尋）...Title (no encryption)."
                        className="w-full px-3 py-2 bg-neutral-900/80 border-2 border-amber-500/80 rounded-lg text-amber-300 font-mono text-sm font-semibold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/50 placeholder:text-amber-500/50 transition-all disabled:opacity-50"
                      />
                    </div>

                    {/* 📝 2. 下方機密內文框 */}
                    <textarea
                      ref={textareaRef}
                      value={activeNoteData.body}
                      onChange={(e) => handleSaveNoteData(activeNoteData.title, e.target.value)}
                      onBlur={(e) => handleSaveNoteData(activeNoteData.title, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Tab' && e.shiftKey) {
                          e.preventDefault();
                          titleInputRef.current?.focus();
                        }
                      }}
                      onClick={updateSelection}
                      onKeyUp={updateSelection}
                      onSelect={updateSelection}
                      disabled={activeNote.isEncrypted && !passphrase}
                      placeholder="從這裡開始輸入機密內容（會隨設定加密，保護隱私）...The following is protected by AES-256 encryption."
                      className="flex-1 w-full bg-transparent resize-none focus:outline-none text-neutral-200 font-mono text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-neutral-600 min-h-[350px]"
                    />
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none pb-30 text-neutral-200">
                    <h1 className="text-xl font-bold text-amber-400 border-b border-neutral-800 pb-2 mb-4">
                      {activeNoteData.title || "Untitled Note"}
                    </h1>

                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
                        p: ({ node, children, ...props }) => {
                          const rawText = Array.isArray(children) ? children.join('') : String(children || '');
                          const isAccountOrSecret = /^(Account|Secret|Password|Key|Token):\s*(.+)/i.exec(rawText.trim());

                          if (isAccountOrSecret) {
                            const label = isAccountOrSecret[1];
                            const value = isAccountOrSecret[2].trim();
                            const keyId = `${activeNote.id}_${label}_${value}`;

                            return (
                              <p className="flex items-center justify-between gap-2 bg-neutral-900/90 border border-neutral-800 px-3 py-2 rounded-lg font-mono text-xs my-2 shadow-md max-w-lg" {...props}>
                                <div className="flex items-center gap-2 truncate flex-1">
                                  <span className="text-emerald-400 font-semibold shrink-0">{label}:</span>
                                  <span className="truncate text-neutral-200">{value}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleCopySecureText(value, keyId)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] flex items-center gap-1.5 transition-all shrink-0 ${copiedKey === keyId
                                    ? "bg-emerald-600 text-white font-bold"
                                    : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700/60"
                                    }`}
                                  title="點擊複製（30秒後自動清空剪貼簿）"
                                >
                                  <img
                                    src="/turtle.svg"
                                    alt="Turtle Icon"
                                    className={`w-3.5 h-3.5 object-contain transition-transform ${copiedKey === keyId ? "scale-125 rotate-12" : ""
                                      }`}
                                  />
                                  {copiedKey === keyId ? (
                                    <>
                                      <Check className="w-3 h-3 text-white" />
                                      <span>已複製 (30s)</span>
                                    </>
                                  ) : (
                                    <span>複製</span>
                                  )}
                                </button>
                              </p>
                            );
                          }
                          return <p {...props}>{children}</p>;
                        },
                        img: ({ node, ...props }) => (
                          <img
                            {...props}
                            className="max-w-full h-auto rounded-lg my-2 border border-neutral-800 shadow-md"
                            alt={props.alt || "Note Image"}
                          />
                        ),
                        a: ({ node, ...props }) => (
                          <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline hover:text-emerald-300" />
                        )
                      }}
                    >
                      {activeNoteData.body}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* 隱藏 Inputs */}
              <input type="file" ref={fileInputRef} onChange={handleImportMarkdown} accept=".md,.txt" className="hidden" />
              <input type="file" ref={wordInputRef} onChange={handleImportWord} accept=".docx" className="hidden" />
              <input type="file" ref={imageInputRef} onChange={handleInsertImage} accept="image/*" className="hidden" />
              <input type="file" ref={cameraInputRef} onChange={handleInsertImage} accept="image/*" capture="environment" className="hidden" />

              {/* 左下角：烏龜2號 預覽/編輯模式切換鈕 */}
              <div className="fixed bottom-6 left-6 z-20 md:left-80 flex items-center gap-2 group">
                <button
                  type="button"
                  onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-90 relative"
                  title={viewMode === 'edit' ? '點擊切換至預覽模式' : '點擊切換至編輯模式'}
                >
                  <img
                    src="/turtle2.svg"
                    alt="Turtle Mode Switcher"
                    className={`w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-transform duration-300 ${viewMode === 'preview' ? 'scale-105 rotate-6' : ''
                      }`}
                  />

                  <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md border border-neutral-900 ${viewMode === 'edit' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}>
                    {viewMode === 'edit' ? '編' : '閱'}
                  </span>
                </button>

                <span className="hidden sm:inline-block px-3 py-1.5 rounded-lg bg-neutral-900/90 border border-neutral-800 text-neutral-300 text-xs font-medium shadow-xl backdrop-blur-md opacity-80 group-hover:opacity-100 transition-opacity">
                  {viewMode === 'edit' ? '✏️ 編輯中 (點烏龜預覽)' : '👁️ 預覽中 (點烏龜編輯)'}
                </span>
              </div>

              {/* 右下角球型折疊工具箱 */}
              <div className="fixed bottom-6 right-6 z-20 flex flex-col items-end gap-2">
                {isFabOpen && (
                  <div className="flex flex-col items-end gap-2 mb-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={activeNote.isEncrypted && !passphrase}
                      className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-full shadow-lg text-xs transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <span>Markdown</span>
                      <FileCode className="w-4 h-4 text-emerald-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => wordInputRef.current?.click()}
                      disabled={activeNote.isEncrypted && !passphrase}
                      className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-full shadow-lg text-xs transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <span>Word (.docx)</span>
                      <Upload className="w-4 h-4 text-blue-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={activeNote.isEncrypted && !passphrase}
                      className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-full shadow-lg text-xs transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <span>Camera</span>
                      <Camera className="w-4 h-4 text-emerald-400" />
                    </button>

                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={activeNote.isEncrypted && !passphrase}
                      className="flex items-center gap-2 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-full shadow-lg text-xs transition-transform active:scale-95 disabled:opacity-50"
                    >
                      <span>Picture</span>
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsFabOpen(!isFabOpen)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 active:scale-90 ${isFabOpen ? "scale-110 rotate-12" : "hover:scale-105"
                    }`}
                  title="工具箱"
                >
                  {isFabOpen ? (
                    <div className="w-12 h-12 rounded-full bg-neutral-800/90 border border-neutral-700 flex items-center justify-center text-neutral-200 shadow-xl backdrop-blur-sm">
                      <X className="w-6 h-6" />
                    </div>
                  ) : (
                    <img
                      src="/turtle1.svg"
                      alt="Turtle Toolbox"
                      className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
                    />
                  )}
                </button>
              </div>

              {/* 🤖 右側懸浮 AI Chatbox 按鈕與彈出對話視窗 */}
              <div className="fixed bottom-24 right-6 z-30 flex flex-col items-end">
                {isChatOpen && (
                  <div className="fixed inset-0 sm:inset-auto sm:bottom-0 sm:right-0 sm:mb-3 w-full sm:w-96 h-full sm:h-[500px] bg-neutral-950/95 sm:bg-neutral-900/95 border-0 sm:border border-indigo-500/30 rounded-none sm:rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                    {/* Chat Header */}
                    <div className="p-3.5 bg-neutral-950/90 border-b border-neutral-800 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                          <Bot className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-neutral-100 flex items-center gap-1.5">
                            TurtleAI 助手
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50">DeepSeek</span>
                          </h3>
                          <p className="text-[10px] text-neutral-400">
                            {isAiEnabled ? "🟢 AI ON · 已開啟當前筆記感知" : "🔴 AI OFF · 狀態保護中 (禁止傳送內容)"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsChatOpen(false)}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Chat 訊息內容區 */}
                    <div ref={chatScrollRef} className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs leading-relaxed">
                      {chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${msg.role === 'user'
                              ? 'bg-indigo-600 text-white rounded-br-none shadow-md'
                              : 'bg-neutral-800/90 text-neutral-200 rounded-bl-none border border-neutral-700/60'
                              }`}
                          >
                            <div className="prose prose-invert max-w-none text-xs">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      ))}

                      {isAiThinking && (
                        <div className="flex justify-start">
                          <div className="bg-neutral-800/90 text-neutral-400 rounded-2xl rounded-bl-none px-3.5 py-2.5 border border-neutral-700/60 flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                            <span>TurtleAI 思考中...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat Footer 輸入框 */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendAiMessage();
                      }}
                      className="p-3 bg-neutral-950/90 border-t border-neutral-800 flex items-center gap-2 shrink-0"
                    >
                      <input
                        type="text"
                        placeholder={isAiEnabled ? "詢問 AI 或輸入指令..." : "🔒 AI 功能目前關閉中..."}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        disabled={isAiThinking || !isAiEnabled}
                        className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 placeholder-neutral-500 disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!inputMessage.trim() || isAiThinking || !isAiEnabled}
                        className="p-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-xl transition-all disabled:opacity-40"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>

                  </div>
                )}

                {/* 懸浮開關按鈕 */}
                <button
                  type="button"
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl ${isChatOpen
                    ? "bg-indigo-600 text-white scale-105"
                    : "bg-indigo-950/90 border border-indigo-500/50 text-indigo-400 hover:scale-110 active:scale-95"
                    }`}
                  title="開啟 TurtleAI 筆記助手"
                >
                  <Bot className="w-6 h-6" />
                </button>
              </div>

            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
            請選擇或建立一份筆記
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <NoteApp />
    </SessionProvider>
  );
}