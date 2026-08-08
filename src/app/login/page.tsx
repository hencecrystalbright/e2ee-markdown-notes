"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Lock, ArrowRight, ShieldCheck, CheckCircle2, XCircle, Loader2, Eye, EyeOff, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);

  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false); // 密碼顯隱切換 State

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 帳號即時重複驗證 State
  const [checkingAccount, setCheckingAccount] = useState(false);
  const [isAccountAvailable, setIsAccountAvailable] = useState<boolean | null>(null);

  // 🛡️ 防爆破 18 分鐘控制 State (試錯次數與倒數秒數)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockCountdown, setLockCountdown] = useState(0);

  // 18 分鐘 = 1080 秒
  const LOCK_TIME_SECONDS = 18 * 60;

  // 1. 初始化讀取 LocalStorage：若先前被鎖定且時間未過，繼續鎖定倒數
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

  // 2. 鎖定秒數即時倒數 Timer
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

  // 格式化秒數為 mm:ss
  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // 帳號重複檢查
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

    // 鎖定狀態下拒絕發送
    if (lockCountdown > 0) return;

    if (isRegister) {
      // 🛡️ 強制驗證：至少 1 個字母 + 至少 6 個數字
      const hasLetter = /[a-zA-Z]/.test(password);
      const digitCount = (password.match(/\d/g) || []).length;

      if (!hasLetter || digitCount < 6) {
        setErrorMsg("⚠️ 註冊密碼不符合規則：必須包含【至少 1 個英文字母】與【至少 6 個數字】！");
        return;
      }

      if (isRegister && isAccountAvailable === false) {
        setErrorMsg("此帳號已被註冊，請選用其他帳號名稱");
        return;
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
              // 第 5 次錯誤：鎖定 18 分鐘
              const lockUntil = Date.now() + LOCK_TIME_SECONDS * 1000;
              localStorage.setItem("login_lock_until", lockUntil.toString());
              setLockCountdown(LOCK_TIME_SECONDS);
              setErrorMsg("⚠️ 登入失敗已達 5 次，已強制鎖定！請等 18 分鐘後再行登入。locked for 18 mins");
            } else if (newAttempts === 4) {
              // 第 4 次錯誤：跳出特別警告
              setErrorMsg("⚠️ 錯誤！如果再錯誤 1 次，需要等 18 分鐘再行登入。");
            } else {
              setErrorMsg(`⚠️錯誤，請重新確認 (剩餘嘗試次數: ${5 - newAttempts} 次)`);
            }
          } else {
            // 登入成功：清除試錯紀錄
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
      <div className="min-h-screen w-screen bg-neutral-950 flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-neutral-900/90 border border-neutral-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center mb-3 shadow-inner">
              <img src="/turtle.svg" alt="Turtle Logo" className="w-10 h-10 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-neutral-100 tracking-tight">TurtleNote</h1>
            <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              端到端加密安全 Personal Encrypted Notes
              若忘記密碼將無法找回!
              If you forget password, you will not be able to retrieve it!
            </p>
          </div>

          <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setErrorMsg(""); setIsAccountAvailable(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${!isRegister
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-neutral-400 hover:text-neutral-200"
                }`}
            >
              登入帳號
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setErrorMsg(""); setIsAccountAvailable(null); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${isRegister
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
            {/* 帳號 (Account) 輸入欄 + 即時驗證圖示 */}
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
                  className={`w-full pl-9 pr-3 py-2.5 text-xs bg-neutral-950 border rounded-xl focus:outline-none transition-colors disabled:opacity-50 ${isRegister && isAccountAvailable === false
                      ? "border-red-500/80 focus:border-red-500 text-neutral-200"
                      : isRegister && isAccountAvailable === true
                        ? "border-emerald-500/80 focus:border-emerald-500 text-neutral-200"
                        : "border-neutral-800 focus:border-emerald-500 text-neutral-200"
                    }`}
                />
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
              </div>
            </div>

            {/* 密碼 輸入欄 + 切換顯隱按鈕 */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">密碼 (Password)</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={lockCountdown > 0}
                  placeholder={isRegister ? "至少1個字母 6 個數字At least 1 letter and 6 numbers..." : "輸入您的密碼Please enter your password"}
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

            {/* 提交／鎖定倒數按鈕 */}
            <button
              type="submit"
              disabled={loading || (isRegister && isAccountAvailable === false) || lockCountdown > 0}
              className={`w-full py-3 px-4 mt-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${lockCountdown > 0
                  ? "bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                }`}
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" /> working...
                </span>
              ) : lockCountdown > 0 ? (
                <span>🔒🔒🔒已鎖定 (請等待Please wait for {formatCountdown(lockCountdown)})</span>
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
    );
  }