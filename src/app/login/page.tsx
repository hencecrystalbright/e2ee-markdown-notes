"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Lock, ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    if (isRegister) {
      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: account, password, name: account }),
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
          setErrorMsg("帳號或密碼錯誤，請重新確認");
        } else {
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
            端到端加密 & 帳號隔離安全筆記庫
          </p>
        </div>

        <div className="grid grid-cols-2 p-1 bg-neutral-950 rounded-xl border border-neutral-800 mb-6">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setErrorMsg(""); }}
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
            onClick={() => { setIsRegister(true); setErrorMsg(""); }}
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
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 帳號 (Account) 輸入欄 */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">使用者帳號 (Account)</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="請輸入您的帳號名稱Please enter your account name..."
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:border-emerald-500 text-neutral-200 placeholder-neutral-600 transition-colors"
              />
              <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            </div>
          </div>

          {/* 密碼 輸入欄 */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">帳號密碼</label>
            <div className="relative">
              <input
                type="password"
                required
                placeholder={isRegister ? "密碼長度至少 6 個字 at least 6 characters" : "輸入您的密碼..."}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-neutral-950 border border-neutral-800 rounded-xl focus:outline-none focus:border-emerald-500 text-neutral-200 placeholder-neutral-600 transition-colors"
              />
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 mt-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>處理中...</span>
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