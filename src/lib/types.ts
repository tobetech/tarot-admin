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
