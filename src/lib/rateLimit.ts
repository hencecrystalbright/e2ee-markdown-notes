import { LRUCache } from 'lru-cache';

// 設定快取：最多紀錄 500 個 IP，資料保留 18 分鐘 (1080,000 ms)
const limiter = new LRUCache<string, number>({
  max: 500,
  ttl: 18 * 60 * 1000,
});

/**
 * 檢查 IP 是否超過登入試錯限制
 * @param ip 請求者的 IP 位址
 * @param limit 允許的最大試錯次數 (預設 5 次)
 * @returns { isRateLimited: boolean, remaining: number }
 */
export function checkRateLimit(ip: string, limit = 5) {
  const currentAttempts = limiter.get(ip) || 0;

  if (currentAttempts >= limit) {
    return { isRateLimited: true, remaining: 0 };
  }

  limiter.set(ip, currentAttempts + 1);
  return { isRateLimited: false, remaining: limit - (currentAttempts + 1) };
}

// 登入成功時清空該 IP 的失敗計數
export function clearRateLimit(ip: string) {
  limiter.delete(ip);
}