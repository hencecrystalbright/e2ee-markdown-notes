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
  X,
  Paperclip
} from "lucide-react";
import { encryptText, decryptText } from "@/lib/crypto";

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
          if (data.length > 0) {
            setActiveNoteId(data[0].id);
          }
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
      }
    } catch (error) {
      console.error("新增筆記失敗:", error);
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

  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;

    const imageUrl = URL.createObjectURL(file);
    const markdownImageTag = `\n![${file.name}](${imageUrl})\n`;
    
    insertFormatting(markdownImageTag, "", "");
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
                className={`p-3.5 cursor-pointer transition-colors ${
                  activeNoteId === note.id
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
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors shrink-0 ${
                    activeNote.isEncrypted
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

              {/* Textarea 編輯器 */}
              <textarea
                ref={textareaRef}
                value={getDisplayedContent(activeNote)}
                onChange={(e) => handleUpdateContent(e.target.value)}
                onClick={updateSelection}
                onKeyUp={updateSelection}
                onSelect={updateSelection}
                disabled={activeNote.isEncrypted && !passphrase}
                placeholder="第 1 行：筆記標題（不加密）&#10;第 2 行起：機密內容..."
                className="w-full flex-1 bg-transparent resize-none focus:outline-none text-neutral-200 font-mono text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-neutral-600 pb-20"
              />

              {/* 隱藏 Inputs */}
              <input type="file" ref={fileInputRef} onChange={handleImportMarkdown} accept=".md,.txt" className="hidden" />
              <input type="file" ref={wordInputRef} onChange={handleImportWord} accept=".docx" className="hidden" />
              <input type="file" ref={imageInputRef} onChange={handleInsertImage} accept="image/*" className="hidden" />
              <input type="file" ref={cameraInputRef} onChange={handleInsertImage} accept="image/*" capture="environment" className="hidden" />

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
                  className={`w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white transition-all duration-300 active:scale-90 ${
                    isFabOpen ? "bg-neutral-700 rotate-45" : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                  title="工具箱"
                >
                  {isFabOpen ? <X className="w-6 h-6" /> : <Paperclip className="w-5 h-5" />}
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