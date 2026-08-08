import { LRUCache } from 'lru-cache';

// 設定快取：保留 18 分鐘 (1080,000 ms)
const limiter = new LRUCache<string, number>({
  max: 1000,
  ttl: 18 * 60 * 1000,
});

/**
 * 檢查 IP 或 帳號 是否超過試錯限制
 */
export function checkRateLimit(ip: string, account?: string, limit = 5) {
  const ipKey = `ip:${ip}`;
  const accountKey = account ? `account:${account.toLowerCase().trim()}` : null;

  const ipAttempts = limiter.get(ipKey) || 0;
  const accountAttempts = accountKey ? (limiter.get(accountKey) || 0) : 0;

  // 只要 IP 或 帳號 任何一個超過 5 次試錯，就直接阻擋！
  if (ipAttempts >= limit || accountAttempts >= limit) {
    return { isRateLimited: true };
  }

  // 增加試錯次數
  limiter.set(ipKey, ipAttempts + 1);
  if (accountKey) {
    limiter.set(accountKey, accountAttempts + 1);
  }

  return { isRateLimited: false };
}

/**
 * 登入成功時，清除該 IP 與 該帳號 的失敗計數
 */
export function clearRateLimit(ip: string, account?: string) {
  limiter.delete(`ip:${ip}`);
  if (account) {
    limiter.delete(`account:${account.toLowerCase().trim()}`);
  }
}