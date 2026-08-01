"use client";

import { useState, useEffect, useRef } from 'react';
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
  X
} from "lucide-react";
import { encryptText, decryptText } from "@/lib/crypto";

// 匯入 Markdown 渲染套件
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 匯入 HTML 解析套件 (讓 mark, span, div 能在預覽渲染)
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
}

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [textColor, setTextColor] = useState("#ef4444");

  // 模式 State：編輯 (edit) 與 預覽 (preview)
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

  // RWD 相關 State：側邊欄開關與右下角 FAB 工具箱開關
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 記錄游標選取位置
  const lastSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

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

    fetchNotes();
  }, []);

  const activeNote = notes.find((n) => n.id === activeNoteId) || notes[0];

  const getDisplayedContent = (note?: Note) => {
    if (!note) return "";
    if (!note.isEncrypted) return note.content;
    if (!passphrase) return "🔒 內容已加密，請在左側輸入金鑰以解密檢視。";
    return decryptText(note.content, passphrase);
  };

  const handleCreateNote = async () => {
    const newNoteData = {
      title: "無標題筆記",
      content: "",
      isEncrypted: false,
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

  const handleUpdateContent = async (rawText: string) => {
    if (!activeNote) return;

    const title = rawText.split("\n")[0]?.replace(/^#*\s*/, "") || "無標題筆記";

    const finalContent = activeNote.isEncrypted && passphrase
      ? encryptText(rawText, passphrase)
      : rawText;

    const updatedNoteData = {
      ...activeNote,
      title,
      content: finalContent,
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

  const toggleEncryption = async () => {
    if (!activeNote) return;

    if (!passphrase) {
      alert("請先在左側輸入加密金鑰！");
      return;
    }

    const currentText = getDisplayedContent(activeNote);
    const nextEncryptedState = !activeNote.isEncrypted;

    const newContent = nextEncryptedState
      ? encryptText(currentText, passphrase)
      : currentText;

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
    if (!confirm("Are you sure you want to delete this note?")) return;

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
    const currentContent = getDisplayedContent(activeNote);

    const selectedText = currentContent.substring(start, end) || defaultText;
    const replacement = `${prefix}${selectedText}${suffix}`;

    const newContent =
      currentContent.substring(0, start) +
      replacement +
      currentContent.substring(end);

    handleUpdateContent(newContent);

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

    // 1. 插入上傳中佔位符
    const loadingPlaceholder = `\n![⏳ 圖片壓縮與上傳中...: ${file.name}]()\n`;
    insertFormatting(loadingPlaceholder, "", "");

    try {
      // 2. 利用 Canvas 在本地做圖片縮放與壓縮 (最長邊上限 1920px, 品質 80%)
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

          // 計算等比例縮放尺寸
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

          // 繪製縮放後的圖片
          ctx.drawImage(img, 0, 0, width, height);

          // 導出壓縮後的 JPEG 檔 (品質 0.8)
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

      // 3. 將壓縮後的 Blob 包裝成 FormData 送出給 Imgur
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

        // 4. 精準替換佔位符為正式圖片網址
        setNotes((prevNotes) => {
          const currentNote = prevNotes.find((n) => n.id === activeNoteId);
          if (!currentNote) return prevNotes;

          const currentContent = currentNote.isEncrypted && passphrase
            ? decryptText(currentNote.content, passphrase)
            : currentNote.content;

          const newRawText = currentContent.includes(loadingPlaceholder.trim())
            ? currentContent.replace(loadingPlaceholder.trim(), finalImageTag.trim())
            : `${currentContent}\n${finalImageTag}`;

          handleUpdateContent(newRawText);

          return prevNotes;
        });
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
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/50">
          {notes
            .filter((n) => n.title.toLowerCase().includes(searchTerm.toLowerCase()))
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
                    {note.title || "無標題筆記"}
                  </span>
                  {note.isEncrypted ? (
                    <Lock className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
                  )}
                </div>
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
            <header className="h-14 border-b border-neutral-800 px-4 flex items-center justify-between bg-neutral-900/30 shrink-0">
              <div className="flex items-center gap-2.5 truncate">
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 md:hidden"
                  title="開啟筆記清單"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <FileText className="w-4 h-4 text-neutral-400 shrink-0" />
                <span className="font-medium text-sm text-neutral-300 truncate">
                  {activeNote.title || "無標題筆記"}
                </span>
              </div>

              <div className="flex items-center gap-2">
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
                      <span className="hidden sm:inline">已使用 AES-256 加密</span>
                      <span className="sm:hidden">加密</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">未加密 (點擊啟用)</span>
                      <span className="sm:hidden">未加密</span>
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

            {/* 常駐顯示的黃色安全提醒 */}
            <div className="mx-4 mt-3 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2 shrink-0">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[11px] leading-tight">
                <b>安全提醒：</b>第 1 行為筆記標題（<b>不加密</b>）。請從第 2 行開始輸入機密資料。
              </span>
            </div>

            <div className="flex-1 p-4 overflow-hidden flex flex-col gap-3 relative">
              {/* 工具列 */}
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
              </div>

              {/* 編輯器 / 預覽器 切換顯示區域 */}
              <div className="flex-1 overflow-y-auto">
                {viewMode === 'edit' ? (
                  <textarea
                    ref={textareaRef}
                    value={getDisplayedContent(activeNote)}
                    onChange={(e) => handleUpdateContent(e.target.value)}
                    onBlur={(e) => handleUpdateContent(e.target.value)}
                    onClick={updateSelection}
                    onKeyUp={updateSelection}
                    onSelect={updateSelection}
                    disabled={activeNote.isEncrypted && !passphrase}
                    placeholder="第 1 行：筆記標題（不加密）&#10;第 2 行起：機密內容..."
                    className="w-full h-full bg-transparent resize-none focus:outline-none text-neutral-200 font-mono text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-neutral-600 pb-20"
                  />
                ) : (
                  <div className="prose prose-invert max-w-none pb-20 text-neutral-200">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw]}
                      components={{
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
                      {getDisplayedContent(activeNote)}
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

                  {/* 烏龜角落的小狀態 Badge 點綴 */}
                  <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-md border border-neutral-900 ${viewMode === 'edit' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}>
                    {viewMode === 'edit' ? 'E' : 'S'}
                  </span>
                </button>

                {/* 懸浮時顯示的精美標籤文字 (Tooltip) */}
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

                {/* 烏龜 FAB 按鈕 */}
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