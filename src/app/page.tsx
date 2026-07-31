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
  AlignRight
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

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 關鍵：記錄使用者最後點擊/選取的游標位置（避免視窗失焦歸零）
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
    if (!confirm("確定要刪除這筆筆記嗎？")) return;

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

  // 即時紀錄游標選取位置
  const updateSelection = () => {
    if (textareaRef.current) {
      lastSelectionRef.current = {
        start: textareaRef.current.selectionStart,
        end: textareaRef.current.selectionEnd,
      };
    }
  };

  // 通用格式化與內容插入核心函式（完全基於 lastSelectionRef 游標位置）
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

    // 計算插入後新游標位置
    const newCursorPos = start + replacement.length;

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      lastSelectionRef.current = { start: newCursorPos, end: newCursorPos };
    }, 0);
  };

  // 1.  Markdown / TXT (在游標處插入)
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
  };

  // 2.  Word (.docx) 解析成 Markdown (在游標處插入)
  const handleImportWord = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      // 使用 mammoth 將 Word 轉成 HTML
      const result = await mammoth.convertToHtml({ arrayBuffer });
      const html = result.value;

      // 使用 turndown 將 HTML 轉成 Markdown
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
      });
      const markdown = turndownService.turndown(html);

      // 精準在游標處插入轉換後的文字
      insertFormatting(`\n${markdown}\n`, "", "");
    } catch (error) {
      console.error("Word 檔案解析失敗:", error);
      alert("解析 Word 檔案失敗，請確保這是標準的 .docx 格式檔案。");
    }

    e.target.value = '';
  };

  // 3. 插入圖片（共用給相簿選取 & 相機拍照，精準在游標處插入）
  const handleInsertImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNote) return;

    const imageUrl = URL.createObjectURL(file);
    const markdownImageTag = `\n![${file.name}](${imageUrl})\n`;
    
    insertFormatting(markdownImageTag, "", "");
    e.target.value = '';
  };

  return (
    <div className="flex h-screen w-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* 側邊欄 Sidebar */}
      <aside className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-900/50">
        <div className="p-4 border-b border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-lg text-neutral-100">
              <Lock className="w-5 h-5 text-emerald-400" />
              <span>VaultNote</span>
            </div>
            <button 
              onClick={handleCreateNote}
              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              title="新增筆記"
            >
              <Plus className="w-5 h-5" />
            </button>
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
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-neutral-900 border border-neutral-700 rounded-md focus:outline-none focus:border-emerald-500 text-neutral-200 placeholder-neutral-500"
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
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-md focus:outline-none focus:border-neutral-600 text-neutral-200 placeholder-neutral-500"
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
                onClick={() => setActiveNoteId(note.id)}
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
                  <span className="truncate max-w-[120px] font-mono text-[10px]">
                    {note.isEncrypted ? "AES-256 加密中" : note.content.slice(0, 15)}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </aside>

      {/* 主編輯區域 */}
      <main className="flex-1 flex flex-col h-full bg-neutral-950">
        {activeNote ? (
          <>
            <header className="h-14 border-b border-neutral-800 px-6 flex items-center justify-between bg-neutral-900/30">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-neutral-400" />
                <span className="font-medium text-sm text-neutral-300">
                  {activeNote.title || "無標題筆記"}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleEncryption}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                    activeNote.isEncrypted
                      ? "bg-emerald-950/80 border border-emerald-600 text-emerald-400 hover:bg-emerald-900/50"
                      : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                  }`}
                >
                  {activeNote.isEncrypted ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>已使用 AES-256 加密</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3.5 h-3.5" />
                      <span>未加密 (點擊啟用)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDeleteNote(activeNote.id)}
                  className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-md transition-colors"
                  title="刪除筆記"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </header>

            {activeNote.isEncrypted && (
              <div className="mx-6 mt-4 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <b>安全提醒：</b>第一行內容會作為筆記標題（<b>不加密公開顯示</b>）。請僅作標題用途，<b>千萬不要輸入任何密碼或機密資料</b>！機密請從第二行開始輸入。
                </span>
              </div>
            )}

            <div className="flex-1 p-6 overflow-hidden flex flex-col gap-3">
              {/* 工具列 */}
              <div className="flex items-center flex-wrap gap-1 p-1.5 bg-neutral-900/80 border border-neutral-800 rounded-lg text-neutral-300">
                <button
                  type="button"
                  onClick={() => insertFormatting("**", "**", "粗體文字")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40"
                  title="粗體"
                >
                  <Bold className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting("*", "*", "斜體文字")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40"
                  title="斜體"
                >
                  <Italic className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting("~~", "~~", "刪除線文字")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40"
                  title="刪除線"
                >
                  <Strikethrough className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting("<mark>", "</mark>", "高亮文字")}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-amber-300 rounded transition disabled:opacity-40"
                  title="高亮"
                >
                  <Highlighter className="w-4 h-4" />
                </button>

                <div className="w-[1px] h-4 bg-neutral-800 mx-1" />

                <div className="relative flex items-center">
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

                <div className="w-[1px] h-4 bg-neutral-800 mx-1" />

                <button
                  type="button"
                  onClick={() => insertFormatting('\n<div align="left">\n', '\n</div>\n', '向左對齊內容')}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40"
                  title="向左對齊"
                >
                  <AlignLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting('\n<div align="center">\n', '\n</div>\n', '置中對齊內容')}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40"
                  title="置中對齊"
                >
                  <AlignCenter className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => insertFormatting('\n<div align="right">\n', '\n</div>\n', '向右對齊內容')}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="p-1.5 hover:bg-neutral-800 hover:text-white rounded transition disabled:opacity-40"
                  title="向右對齊"
                >
                  <AlignRight className="w-4 h-4" />
                </button>
              </div>

              {/* Textarea: 嚴格綁定游標即時監聽 */}
              <textarea
                ref={textareaRef}
                value={getDisplayedContent(activeNote)}
                onChange={(e) => handleUpdateContent(e.target.value)}
                onClick={updateSelection}
                onKeyUp={updateSelection}
                onSelect={updateSelection}
                disabled={activeNote.isEncrypted && !passphrase}
                placeholder={
                  activeNote.isEncrypted 
                    ? "第 1 行：筆記標題（未加密，請勿輸入機密資料）\n第 2 行起：加密內容（受 AES-256 保護）..."
                    : "開始寫點什麼吧..."
                }
                className="w-full flex-1 bg-transparent resize-none focus:outline-none text-neutral-200 font-mono text-sm leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-neutral-600"
              />

              {/* 隱藏的 Inputs */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportMarkdown}
                accept=".md,.txt"
                className="hidden"
              />
              <input
                type="file"
                ref={wordInputRef}
                onChange={handleImportWord}
                accept=".docx"
                className="hidden"
              />
              <input
                type="file"
                ref={imageInputRef}
                onChange={handleInsertImage}
                accept="image/*"
                className="hidden"
              />
              <input
                type="file"
                ref={cameraInputRef}
                onChange={handleInsertImage}
                accept="image/*"
                capture="environment"
                className="hidden"
              />

              {/* 底部按鈕區 */}
              <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-end gap-2 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span> Markdown</span>
                </button>

                <button
                  type="button"
                  onClick={() => wordInputRef.current?.click()}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-3.5 h-3.5 text-blue-400" />
                  <span> Word (.docx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Camera className="w-3.5 h-3.5 text-emerald-400" />
                  <span> CAMERA</span>
                </button>

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={activeNote.isEncrypted && !passphrase}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span> PICTURE</span>
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