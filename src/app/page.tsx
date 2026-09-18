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
  Check,
  Key,
  ChevronDown,
  ChevronUp
} from "lucide-react";

// 加解密與工具
import { encryptText, decryptText } from "@/lib/crypto";

// Markdown 渲染與插件套件
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [language, setLanguage] = useState<'zh' | 'en'>('zh'); // 系統語言切換

  // 🏷️ Tag & Emoji 控制列動態折疊 State
  const [isTagSectionOpen, setIsTagSectionOpen] = useState(false);
  const [isEmojiSectionOpen, setIsEmojiSectionOpen] = useState(false);
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

  // 拆分標題與內文 Helper
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

  // 建立新筆記
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

  // Tag 新增與移除邏輯
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

  // 一鍵複製與 30 秒自動清空剪貼簿機制
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

  // 發送 AI 訊息
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

  // 處理自動縮網址的貼上攔截
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    const url = pastedText.trim();

    if (/^https?:\/\/[^\s]+$/.test(url) && url.length > 30) {
      e.preventDefault();

      const loadingMark = `[⏳ 產生短網址中...]`;
      insertFormatting(loadingMark, "", "");

      try {
        const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
        const shortUrl = res.ok ? await res.text() : url;

        if (textareaRef.current) {
          const currentBody = textareaRef.current.value;
          const newBody = currentBody.replace(loadingMark, shortUrl);
          const { title } = getNoteTitleAndBody(activeNote);
          handleSaveNoteData(title, newBody);
        }
      } catch (error) {
        if (textareaRef.current) {
          const currentBody = textareaRef.current.value;
          const newBody = currentBody.replace(loadingMark, url);
          const { title } = getNoteTitleAndBody(activeNote);
          handleSaveNoteData(title, newBody);
        }
      }
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

  // 🖼️ 圖片壓縮與 ImgBB 上傳邏輯（已完美替換）
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

      // ✅ 換成 ImgBB 穩定免驗證 API (請將下方填入您的 API Key)
      const IMGBB_API_KEY = "貼上你剛剛複製的_IMGBB_API_KEY";

      const formData = new FormData();
      formData.append('image', compressedBlob);

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data?.url) {
        const imageUrl = data.data.url;
        const finalImageTag = `\n![${file.name}](${imageUrl})\n`;

        const { title, body } = getNoteTitleAndBody(activeNote);
        const newBody = body.includes(loadingPlaceholder.trim())
          ? body.replace(loadingPlaceholder.trim(), finalImageTag.trim())
          : `${body}\n${finalImageTag}`;

        handleSaveNoteData(title, newBody);
      } else {
        console.error("ImgBB 報錯:", data);
        alert(`圖片上傳失敗: ${data.error?.message || '請確認 API Key 是否正確'}`);
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

          {/* 側邊欄 Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-lg text-neutral-100">
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
              {language === 'zh' ? '主加密金鑰 (Passphrase)' : 'Passphrase'}
            </label>
            <div className="relative">
              <input
                type={showPassphrase ? "text" : "password"}
                placeholder={language === 'zh' ? "輸入解密/加密密碼..." : "Enter passphrase..."}
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
              placeholder={language === 'zh' ? "搜尋筆記..." : "Search notes..."}
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
                {language === 'zh' ? '全部' : 'All'}
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
                    {note.isEncrypted ? (language === 'zh' ? "AES-256 加密中" : "AES-256 Encrypted") : note.content.slice(0, 15)}
                  </span>
                </div>
              </div>
            ))}
        </div>

        {/* 左下角設定與彈出選單 */}
        <div className="relative mt-auto border-t border-neutral-800 bg-neutral-900 shrink-0">
          {isSettingsOpen && (
            <div className="absolute bottom-[100%] left-0 w-full bg-neutral-900 border-t border-neutral-800 p-2.5 flex flex-col gap-2 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] z-50">
              <button
                onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
                className="flex items-center justify-center w-full py-2 border border-neutral-700 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-md text-xs font-bold transition-colors shadow-sm"
              >
                {language === 'zh' ? '🌐 切換至英文 (English)' : '🌐 Switch to Chinese'}
              </button>

              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-md text-red-400 border border-red-900/30 hover:text-white hover:bg-red-600 transition-colors text-xs font-medium shadow-sm"
              >
                <LogOut className="w-4 h-4" />
                <span>{language === 'zh' ? '登出帳號' : 'Sign Out'}</span>
              </button>
            </div>
          )}

          <button
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="w-full p-3.5 flex items-center justify-between hover:bg-neutral-800 transition-colors outline-none"
            title={language === 'zh' ? '系統設定' : 'Settings'}
          >
            <div className="flex items-center gap-3">
              <img
                src="/fish1.svg"
                alt="Settings"
                className="w-6 h-6 object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
              />
              <span className="text-sm font-medium text-neutral-200">
                {language === 'zh' ? 'SETUP' : 'Setup'}
              </span>
            </div>

            {isSettingsOpen ? (
              <ChevronDown className="w-4 h-4 text-neutral-500" />
            ) : (
              <ChevronUp className="w-4 h-4 text-neutral-500" />
            )}
          </button>
        </div>
      </aside>

      {/* 主編輯區域 */}
      <main className="flex-1 flex flex-col h-full bg-neutral-950 min-w-0 relative">
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
                  onClick={() => handleSendAiMessage(language === 'zh' ? "請幫我提煉這篇筆記的核心重點與摘要。" : "Please summarize the core points of this note.")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-500/60 text-indigo-400 hover:bg-indigo-900/80 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Summary"
                >
                  <Sparkles className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage(language === 'zh' ? "請用通俗易懂、簡潔白話的語言重新表達這篇筆記。" : "Please rephrase this note in simple, easy-to-understand language.")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-emerald-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Simple"
                >
                  <Smile className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage(language === 'zh' ? "請把這篇筆記轉化為商務、嚴謹、專業的報告口吻。" : "Please convert this note into a professional, formal business report tone.")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-amber-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Pro"
                >
                  <Briefcase className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage(language === 'zh' ? "請將這篇筆記內容流暢翻譯為英文版本，並保持原本的 Markdown 格式。" : "Please translate this note fluently into English while preserving the Markdown formatting.")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-blue-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="ENG"
                >
                  <Languages className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleSendAiMessage(language === 'zh' ? "請將這篇筆記內文拆解為結構清晰的大綱架構 (Headings & Bullets)。" : "Please break this note down into a clear outline structure.")}
                  disabled={isAiThinking || !isAiEnabled}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-purple-400 hover:bg-neutral-800 hover:border-neutral-700 transition-all shrink-0 active:scale-95 disabled:opacity-40"
                  title="Outline"
                >
                  <ListTree className="w-4 h-4" />
                </button>
              </div>

              {/* 頂部操作按鈕區 */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={toggleEncryption}
                  className={`p-2 rounded-lg border transition-all ${activeNote.isEncrypted
                    ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-400"
                    : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  title={activeNote.isEncrypted ? "已加密 (點擊解密)" : "未加密 (點擊加密)"}
                >
                  {activeNote.isEncrypted ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => handleDeleteNote(activeNote.id)}
                  className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
                  title="刪除筆記"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* 🛠️ 工具列 ToolBar */}
            <div className="bg-neutral-900/60 border-b border-neutral-800 p-2 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none shrink-0">
              <div className="flex items-center gap-1 shrink-0">
                {/* 模式切換按鈕 */}
                <button
                  onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'preview'
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                >
                  {viewMode === 'edit' ? "Preview" : "Edit"}
                </button>

                <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

                <button
                  onClick={() => insertFormatting("**", "**", "粗體")}
                  className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="粗體"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertFormatting("*", "*", "斜體")}
                  className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="斜體"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertFormatting("~~", "~~", "刪除線")}
                  className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="刪除線"
                >
                  <Strikethrough className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertFormatting("== ", " ==", "螢光筆")}
                  className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="螢光黃底"
                >
                  <Highlighter className="w-4 h-4" />
                </button>

                <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

                <button
                  onClick={() => insertFormatting("<span style='color:red;'>", "</span>", "紅字")}
                  className="p-1.5 rounded hover:bg-neutral-800 text-red-400 hover:text-red-300"
                  title="紅字"
                >
                  <Palette className="w-4 h-4" />
                </button>

                <button
                  onClick={() => insertFormatting("<div align='left'>\n", "\n</div>", "靠左內容")}
                  className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="靠左對齊"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertFormatting("<div align='center'>\n", "\n</div>", "居中內容")}
                  className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="置中對齊"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>
                <button
                  onClick={() => insertFormatting("<div align='right'>\n", "\n</div>", "靠右內容")}
                  className="p-1.5 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200"
                  title="靠右對齊"
                >
                  <AlignRight className="w-4 h-4" />
                </button>

                <div className="h-4 w-[1px] bg-neutral-800 mx-1" />

                <button
                  onClick={() => setIsTagSectionOpen(!isTagSectionOpen)}
                  className={`p-1.5 rounded transition-colors ${isTagSectionOpen ? "bg-emerald-950 text-emerald-400" : "hover:bg-neutral-800 text-neutral-400"}`}
                  title="標籤管理"
                >
                  <TagIcon className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsEmojiSectionOpen(!isEmojiSectionOpen)}
                  className={`p-1.5 rounded transition-colors ${isEmojiSectionOpen ? "bg-amber-950 text-amber-400" : "hover:bg-neutral-800 text-neutral-400"}`}
                  title="插入 Icon/Emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
              </div>

              {/* 右側 AI 保密開關與聊天按鈕 */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setIsAiEnabled(!isAiEnabled)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${isAiEnabled
                    ? "bg-emerald-950/80 border-emerald-500/60 text-emerald-400"
                    : "bg-neutral-900 border-neutral-800 text-neutral-500 hover:text-neutral-300"
                    }`}
                  title={isAiEnabled ? "AI 已連線" : "AI 已關閉 (保密中)"}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{isAiEnabled ? "AI ON" : "AI OFF"}</span>
                </button>

                <button
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={`p-1.5 rounded-lg border transition-colors ${isChatOpen ? "bg-indigo-950 border-indigo-500 text-indigo-400" : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
                    }`}
                  title="AI 對話助理"
                >
                  <Bot className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 🏷️ 折疊的 Tag 標籤輸入列 */}
            {isTagSectionOpen && (
              <div className="bg-neutral-900 border-b border-neutral-800 p-2.5 flex items-center gap-2 flex-wrap text-xs shrink-0 animate-in fade-in duration-200">
                <span className="text-neutral-400 font-medium flex items-center gap-1">
                  <TagIcon className="w-3.5 h-3.5 text-emerald-400" />
                  標籤:
                </span>
                {activeNote.tags?.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-emerald-400 font-mono flex items-center gap-1">
                    #{t}
                    <button onClick={() => handleRemoveTag(t)} className="hover:text-red-400 ml-1">×</button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="新增標籤..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    className="bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500 w-24"
                  />
                  <button
                    onClick={() => handleAddTag(tagInput)}
                    className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs"
                  >
                    新增
                  </button>
                </div>
              </div>
            )}

            {/* 😃 折疊的 Icon/Emoji 選單 */}
            {isEmojiSectionOpen && (
              <div className="bg-neutral-900 border-b border-neutral-800 p-2 flex items-center gap-2 flex-wrap text-base shrink-0 animate-in fade-in duration-200">
                {['🐢', '🔐', '📌', '💡', '⚠️', '✅', '🚀', '⭐', '📝', '🔥', '🎯', '❤️'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => insertFormatting(emoji, "", "")}
                    className="p-1 hover:bg-neutral-800 rounded transition-transform active:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* 編輯器與預覽主體 */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden gap-4">
              <input
                ref={titleInputRef}
                type="text"
                placeholder="筆記標題..."
                value={activeNoteData.title}
                onChange={(e) => handleSaveNoteData(e.target.value, activeNoteData.body)}
                className="w-full text-xl font-bold bg-transparent border-b border-neutral-800 pb-2 focus:outline-none focus:border-emerald-500 text-neutral-100 placeholder-neutral-600"
              />

              <div className="flex-1 flex flex-col relative min-h-0">
                {viewMode === 'edit' ? (
                  <textarea
                    ref={textareaRef}
                    value={activeNoteData.body}
                    onChange={(e) => handleSaveNoteData(activeNoteData.title, e.target.value)}
                    onSelect={updateSelection}
                    onKeyUp={updateSelection}
                    onClick={updateSelection}
                    onPaste={handlePaste}
                    placeholder="在此輸入筆記內容 (支援 Markdown 語法)..."
                    className="w-full h-full bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-neutral-300 placeholder-neutral-600 overflow-y-auto"
                  />
                ) : (
                  <div className="w-full h-full overflow-y-auto prose prose-invert max-w-none font-sans text-neutral-300 leading-relaxed">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkBreaks]}
                      rehypePlugins={[rehypeRaw]}
                    >
                      {activeNoteData.body}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>

            {/* 側邊 AI 對話面板 (Slide-over Drawer) */}
            {isChatOpen && (
              <div className="absolute top-14 right-0 bottom-0 w-80 sm:w-96 bg-neutral-900/95 backdrop-blur-md border-l border-neutral-800 z-20 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
                <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 font-medium text-xs text-neutral-200">
                    <Bot className="w-4 h-4 text-indigo-400" />
                    <span>TurtleAI 助理</span>
                  </div>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="p-1 rounded hover:bg-neutral-800 text-neutral-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* 對話訊息區 */}
                <div ref={chatScrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 text-xs">
                  {chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-2.5 rounded-lg leading-relaxed ${msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-neutral-800 text-neutral-200 border border-neutral-700/80 rounded-bl-none'
                          }`}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}

                  {isAiThinking && (
                    <div className="flex items-center gap-2 text-neutral-500 text-xs italic">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                      <span>AI 正在思考並整理中...</span>
                    </div>
                  )}
                </div>

                {/* 對話輸入框 */}
                <div className="p-2.5 border-t border-neutral-800 bg-neutral-950 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={isAiEnabled ? "詢問 AI 關於這篇筆記..." : "請先在頂部開啟 AI 開關..."}
                    disabled={!isAiEnabled || isAiThinking}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendAiMessage();
                      }
                    }}
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-md px-2.5 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSendAiMessage()}
                    disabled={!isAiEnabled || isAiThinking || !inputMessage.trim()}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white rounded-md transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 右下角 Floating Action Button (FAB) 選單 */}
            <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
              {isFabOpen && (
                <div className="flex flex-col gap-2 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-neutral-200 px-3 py-2 rounded-lg text-xs shadow-lg hover:bg-neutral-800"
                  >
                    <FileCode className="w-4 h-4 text-emerald-400" />
                    匯入 Markdown (.md)
                  </button>

                  <button
                    onClick={() => wordInputRef.current?.click()}
                    className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-neutral-200 px-3 py-2 rounded-lg text-xs shadow-lg hover:bg-neutral-800"
                  >
                    <FileText className="w-4 h-4 text-blue-400" />
                    匯入 Word (.docx)
                  </button>

                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-neutral-200 px-3 py-2 rounded-lg text-xs shadow-lg hover:bg-neutral-800"
                  >
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    插入圖片 (ImgBB)
                  </button>

                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-neutral-200 px-3 py-2 rounded-lg text-xs shadow-lg hover:bg-neutral-800"
                  >
                    <Camera className="w-4 h-4 text-purple-400" />
                    拍照上傳
                  </button>
                </div>
              )}

              <button
                onClick={() => setIsFabOpen(!isFabOpen)}
                className={`p-3.5 rounded-full text-white shadow-xl transition-all ${isFabOpen ? "bg-neutral-800 rotate-45" : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-600 font-mono text-sm">
            請選取或建立一份筆記開始編輯 🐢
          </div>
        )}
      </main>

      {/* 隱藏的檔案上傳 Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt"
        className="hidden"
        onChange={handleImportMarkdown}
      />
      <input
        ref={wordInputRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={handleImportWord}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInsertImage}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInsertImage}
      />
    </div>
  );
}

export default function Page() {
  return (
    <SessionProvider>
      <NoteApp />
    </SessionProvider>
  );
}
