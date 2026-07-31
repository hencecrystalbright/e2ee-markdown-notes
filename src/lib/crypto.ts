import CryptoJS from "crypto-js";

/**
 * 使用 AES-256 加密文字
 * @param text 要加密的明文
 * @param secretKey 使用者輸入的金鑰/密碼
 */
export const encryptText = (text: string, secretKey: string): string => {
  if (!text || !secretKey) return text;
  try {
    return CryptoJS.AES.encrypt(text, secretKey).toString();
  } catch (error) {
    console.error("加密失敗:", error);
    return text;
  }
};

/**
 * 使用 AES-256 解密文字
 * @param ciphertext 已加密的密文
 * @param secretKey 使用者輸入的金鑰/密碼
 */
export const decryptText = (ciphertext: string, secretKey: string): string => {
  if (!ciphertext || !secretKey) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    // 若解密出來是空字串，代表金鑰錯誤
    return originalText || "[解密失敗：金鑰不正確]";
  } catch (error) {
    return "[解密失敗：金鑰不正確]";
    
  }
  
};