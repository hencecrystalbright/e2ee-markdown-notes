"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Lock, ArrowRight, ShieldCheck, CheckCircle2, XCircle, Loader2, Eye, EyeOff, ShieldAlert, KeyRound, Zap, FileCode2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [checkingAccount, setCheckingAccount] = useState(false);
  const [isAccountAvailable, setIsAccountAvailable] = useState<boolean | null>(null);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  const LOCK_TIME_SECONDS = 18 * 60;

  useEffect(() => {
    const savedLockUntil = localStorage.getItem("login_lock_until");
    if (savedLockUntil) {
      const lockUntil = parseInt(savedLockUntil, 10);
      const now = Date.now();
      if (lockUntil > now) {
        const remainingSeconds = Math.ceil((lockUntil - now) / 1000);
        setLockCountdown(remainingSeconds);
        setFailedAttempts(5);
      } else {
        localStorage.removeItem("login_lock_until");
      }
    }
  }, []);

  useEffect(() => {
    if (lockCountdown <= 0) return;

    const timer = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          localStorage.removeItem("login_lock_until");
          setFailedAttempts(0);
          setErrorMsg("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockCountdown]);

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!isRegister || !account.trim()) {
      setIsAccountAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingAccount(true);
      try {
        const res = await fetch(`/api/register?checkAccount=${encodeURIComponent(account.trim())}`);
        const data = await res.json();
        setIsAccountAvailable(data.available);
      } catch (err) {
        setIsAccountAvailable(null);
      } finally {
        setCheckingAccount(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [account, isRegister]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (lockCountdown > 0) return;

    if (isRegister) {
      const hasLetter = /[a-zA-Z]/.test(password);
      const digitCount = (password.match(/\d/g) || []).length;

      if (!hasLetter || digitCount < 6) {
        setErrorMsg("⚠️ 註冊密碼不符合規則：必須包含【至少 1 個英文字母】與【至少 6 個數字】！");
        return;
      }

      if (isAccountAvailable === false) {
        setErrorMsg("此帳號已被註冊，請選用其他帳號名稱");
        return;
      }
    }

    setLoading(true);

    if (isRegister) {
      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(data.error || "註冊失敗，請重試");
          setLoading(false);
          return;
        }

        const signInRes = await signIn("credentials", {
          email: account,
          password,
          redirect: false,
        });

        if (signInRes?.error) {
          setErrorMsg("註冊成功，但自動登入失敗，請手動登入");
          setIsRegister(false);
        } else {
          setFailedAttempts(0);
          localStorage.removeItem("login_lock_until");
          router.push("/");
          router.refresh();
        }
      } catch (err) {
        setErrorMsg("連線異常，請稍後再試");
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const result = await signIn("credentials", {
          email: account,
          password,
          redirect: false,
        });

        if (result?.error) {
          const newAttempts = failedAttempts + 1;
          setFailedAttempts(newAttempts);

          if (newAttempts >= 5) {
            const lockUntil = Date.now() + LOCK_TIME_SECONDS * 1000;
            localStorage.setItem("login_lock_until", lockUntil.toString());
            setLockCountdown(LOCK_TIME_SECONDS);
            setErrorMsg("⚠️ 登入失敗已達 5 次，系統已強制鎖定！請等 18 分鐘後再行登入。");
          } else if (newAttempts === 4) {
            setErrorMsg("⚠️ 帳號或密碼錯誤！如果再錯誤 1 次，需要等 18 分鐘再行登入。");
          } else {
            setErrorMsg(`帳號或密碼錯誤，請重新確認 (剩餘嘗試次數: ${5 - newAttempts} 次)`);
          }
        } else {
          setFailedAttempts(0);
          localStorage.removeItem("login_lock_until");
          router.push("/");
          router.refresh();
        }
      } catch (err) {
        setErrorMsg("登入失敗，請檢查網路狀態");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen w-screen bg-neutral-950 flex items-center justify-center p-4 lg:p-12 font-sans relative overflow-hidden">
      {/* 背景光暈效果 */}
      <div className="absolute top-1/3 left-1/4 -translate-x-1/2 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 w-[400px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* 雙欄主容器 */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        
        {/* 👈 左側：筆記建立大綱與優點 (灰色字) */}
        <div className="lg:col-span-7 space-y-6 pr-0 lg:pr-6 text-neutral-400">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-lg">
              <img src="/turtle.svg" alt="Turtle Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-100 tracking-tight">TurtleNote</h1>
              <p className="text-xs text-neutral-500 font-mono">Personal Encrypted Workspace</p>
            </div>
          </div>

          <div className="border-t border-neutral-800/80 pt-6 space-y-5">
            {/* 特色 1 */}
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-neutral-900/90 border border-neutral-800 text-emerald-400 shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-300">端到端 AES-256 本地加密</h3>
                <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">
                  主金鑰僅保留於您的記憶中，內文於前端加密後才傳輸。伺服器與資料庫僅保存無意義密文，隱私安全無虞。
                </p>
              </div>
            </div>

            {/* 特色 2 */}
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-neutral-900/90 border border-neutral-800 text-indigo-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-300">企業級防爆破安控 (Rate Limit)</h3>
                <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">
                  具備 IP 與帳號雙重鎖定機制，5 次試錯失敗即阻擋 18 分鐘，線上字典檔暴力破解路徑全面封鎖。
                </p>
              </div>
            </div>

            {/* 特色 3 */}
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-neutral-900/90 border border-neutral-800 text-amber-400 shrink-0">
                <FileCode2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-neutral-300">極致簡潔與 Markdown 渲染</h3>
                <p className="text-xs text-neutral-500 leading-relaxed mt-0.5">
                  內建機密結構化範本、30 秒剪貼簿自動清空、單行 Tag 標籤管理，提供流暢無干擾的撰寫體驗。
                </p>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-neutral-600 bg-neutral-900/40 border border-neutral-800/50 p-3 rounded-xl font-mono">
            ⚠️ 溫馨提示：若遺失加密主金鑰 (Passphrase)，加密內容將永無法還原！
          </div>
        </div>

        {/* 👉 右側：登入 / 註冊卡片 */}
        <div className="lg:col-span-5 w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setErrorMsg(""); setIsAccountAvailable(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                !isRegister 
                  ? "bg-emerald-600 text-white shadow-md" 
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              登入帳號
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setErrorMsg(""); setIsAccountAvailable(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                isRegister 
                  ? "bg-emerald-600 text-white shadow-md" 
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              建立新帳號
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-neutral-400">使用者帳號 (Account)</label>
                {isRegister && account.trim() && (
                  <span className="text-[10px]">
                    {checkingAccount ? (
                      <span className="text-neutral-500 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> 檢查中...
                      </span>
                    ) : isAccountAvailable === true ? (
                      <span className="text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 帳號可以使用
                      </span>
                    ) : isAccountAvailable === false ? (
                      <span className="text-red-400 font-medium flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> 帳號已被使用
                      </span>
                    ) : null}
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  required
                  disabled={lockCountdown > 0}
                  placeholder="請輸入您的帳號名稱"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2.5 text-xs bg-neutral-950 border rounded-xl focus:outline-none transition-colors disabled:opacity-50 ${
                    isRegister && isAccountAvailable === false 
                      ? "border-red-500/80 focus:border-red-500 text-neutral-200" 
                      : isRegister && isAccountAvailable === true
                      ? "border-emerald-500/80 focus:border-emerald-500 text-neutral-200"
                      : "border-neutral-800 focus:border-emerald-500 text-neutral-200"
                  }`}
                />
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">密碼 (Password)</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={lockCountdown > 0}
                  placeholder={isRegister ? "需包含至少1個字母與6個數字" : "輸入您的密碼 at least 6 characters..."}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:border-emerald-500 text-neutral-200 placeholder-neutral-600 transition-colors disabled:opacity-50"
                />
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-neutral-500 hover:text-neutral-300 transition-colors"
                  title={showPassword ? "隱藏密碼" : "顯示密碼"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || (isRegister && isAccountAvailable === false) || lockCountdown > 0}
              className={`w-full py-3 px-4 mt-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                lockCountdown > 0
                  ? "bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-950/50 disabled:opacity-50"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" /> 處理中...
                </span>
              ) : lockCountdown > 0 ? (
                <span>🔒 系統已鎖定 (請等待 {formatCountdown(lockCountdown)})</span>
              ) : (
                <>
                  <span>{isRegister ? "註冊並登入" : "立即登入"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}