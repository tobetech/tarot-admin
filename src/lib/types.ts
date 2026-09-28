export type PaymentMethod = "cash" | "qr";
export type TransactionKind = "topup" | "reading";
export type TransactionStatus = "pending" | "completed" | "failed" | "expired";
export type Language = "th" | "en" | "my" | "zh" | "km" | "lo";

export interface Transaction {
  id: string;
  machine_id: string;
  kind: TransactionKind;
  payment_method: PaymentMethod | null;
  amount: number | null;
  credits: number;
  language: Language | null;
  status: TransactionStatus;
  qr_order_id: string | null;
  created_at: string;
}

export interface Machine {
  machine_id: string;
  name: string;
  location: string | null;
  last_seen_at: string | null;
  created_at: string;
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  th: "ไทย",
  en: "English",
  my: "မြန်မာ",
  zh: "中文",
  km: "ខ្មែរ",
  lo: "ລາວ",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "เงินสด",
  qr: "QR Code",
};

// ---------------------------------------------------------------------------
// ตู้เซซะอุราไน (seiza_machines / seiza_transactions) - โครงสร้างเดียวกับ tarot แต่รองรับ
// 9 ภาษา (เพิ่ม ja/ko/vi) และมีคอลัมน์ topic (หัวข้อที่ลูกค้าเลือกดู)
// ---------------------------------------------------------------------------
export type SeizaLanguage = Language | "ja" | "ko" | "vi";
export type SeizaTopic = "general" | "love" | "money" | "work" | "health" | "luck";

export interface SeizaTransaction extends Omit<Transaction, "language"> {
  language: SeizaLanguage | null;
  topic: SeizaTopic | null;
}

export const SEIZA_LANGUAGE_LABELS: Record<SeizaLanguage, string> = {
  ...LANGUAGE_LABELS,
  ja: "日本語",
  ko: "한국어",
  vi: "Tiếng Việt",
};

export const SEIZA_TOPIC_LABELS: Record<SeizaTopic, string> = {
  general: "ดวงรวม",
  love: "ความรัก",
  money: "การเงิน",
  work: "การงาน",
  health: "สุขภาพ",
  luck: "โชคลาภ",
};
