"use client"

import { useEffect, useState } from "react"
import { SettingsModal } from "@/components/settings-modal"
import {
  Settings,
  FileDown,
  Users,
  TrendingUp,
  Globe,
  CreditCard,
  Phone,
  Bell,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface AnalyticsData {
  activeUsers: number
  todayVisitors: number
  totalVisitors: number
  visitorsWithCard: number
  visitorsWithPhone: number
  devices: Array<{ device: string; users: number }>
  countries: Array<{ country: string; users: number }>
}

interface DashboardHeaderProps {
  onExportAllCards?: () => void
  isExportingAllCards?: boolean
}

export function DashboardHeader({ onExportAllCards, isExportingAllCards }: DashboardHeaderProps = {}) {
  const { user, logout } = useAuth()
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    activeUsers: 0,
    todayVisitors: 0,
    totalVisitors: 0,
    visitorsWithCard: 0,
    visitorsWithPhone: 0,
    devices: [],
    countries: [],
  })
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch('/api/analytics')
        const data = await response.json()
        setAnalytics(data)
      } catch (error) {
        console.error('Error fetching analytics:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
    // Refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000)
    return () => clearInterval(interval)
  }, [])

  const num = (v: number) => (loading ? "—" : v)

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm select-none" dir="rtl">
      <div className="flex items-center gap-0 h-[46px] px-3 border-b border-gray-200">
        {/* Logo */}
        <div className="flex items-center gap-2 pl-4 border-l border-gray-200 mr-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center shadow-lg">
            <span className="text-gray-900 font-black text-xs">B</span>
          </div>
          <span className="text-gray-800 font-bold text-sm tracking-wide">BeCare</span>
        </div>

        {/* Stats — horizontally scrollable */}
        <div className="flex items-center gap-0 ml-auto overflow-x-auto scrollbar-hide">
          {/* Active visitors (online now) */}
          <div className="relative">
            <button
              className="flex items-center gap-1.5 px-3 h-[46px] hover:bg-gray-100 transition-colors text-xs border-l border-gray-200"
              title="الزوار الحاليون"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block"></span>
              <span className="text-green-600 font-bold text-sm">{num(analytics.activeUsers)}</span>
              <Users className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {/* Today */}
          <div className="flex items-center gap-1.5 px-3 h-[46px] border-l border-gray-200">
            <TrendingUp className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-gray-500 text-[11px]">اليوم</span>
            <span className="text-gray-800 font-bold text-sm">{num(analytics.todayVisitors)}</span>
          </div>

          {/* Total */}
          <div className="flex items-center gap-1.5 px-3 h-[46px] border-l border-gray-200">
            <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-gray-500 text-[11px]">إجمالي</span>
            <span className="text-gray-800 font-bold text-sm">{num(analytics.totalVisitors)}</span>
          </div>

          {/* With card */}
          <div className="flex items-center gap-1.5 px-3 h-[46px] border-l border-gray-200">
            <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-blue-600 font-bold text-sm">{num(analytics.visitorsWithCard)}</span>
          </div>

          {/* With phone */}
          <div className="flex items-center gap-1.5 px-3 h-[46px] border-l border-gray-200">
            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-emerald-600 font-bold text-sm">{num(analytics.visitorsWithPhone)}</span>
          </div>

          {/* Divider */}
          <div className="w-px h-5 bg-gray-100 mx-1 shrink-0"></div>

          {/* Visitors triple: online / today / total */}
          <div className="flex items-center gap-1.5 px-3 h-[46px] border-l border-gray-200">
            <span className="text-[11px] text-gray-500 shrink-0">زوار</span>
            <span className="text-green-600 font-bold text-sm">{num(analytics.activeUsers)}</span>
            <span className="text-gray-400 text-xs">/</span>
            <span className="text-amber-600 font-bold text-sm">{num(analytics.todayVisitors)}</span>
            <span className="text-gray-400 text-xs">/</span>
            <span className="text-gray-400 font-bold text-sm">{num(analytics.totalVisitors)}</span>
          </div>

          {/* Customers triple: with-card / with-phone / total */}
          <div className="flex items-center gap-1.5 px-3 h-[46px] border-l border-gray-200">
            <span className="text-[11px] text-gray-500 shrink-0">عملاء</span>
            <span className="text-green-600 font-bold text-sm">{num(analytics.visitorsWithCard)}</span>
            <span className="text-gray-400 text-xs">/</span>
            <span className="text-amber-600 font-bold text-sm">{num(analytics.visitorsWithPhone)}</span>
            <span className="text-gray-400 text-xs">/</span>
            <span className="text-gray-400 font-bold text-sm">{num(analytics.totalVisitors)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0 border-r border-gray-200 mr-auto">
          {onExportAllCards && (
            <button
              onClick={onExportAllCards}
              disabled={isExportingAllCards}
              className="flex items-center justify-center w-10 h-[46px] hover:bg-gray-100 transition-colors border-l border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
              title="تصدير جميع البطاقات PDF"
            >
              <FileDown className="w-4 h-4 text-gray-400 hover:text-gray-900 transition-colors" />
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center justify-center w-10 h-[46px] hover:bg-gray-100 transition-colors border-l border-gray-200"
            title="إعدادات"
          >
            <Settings className="w-4 h-4 text-gray-400 hover:text-gray-900 transition-colors" />
          </button>
          <button
            className="flex items-center justify-center w-10 h-[46px] hover:bg-gray-100 transition-colors border-l border-gray-200"
            title="تنبيهات"
          >
            <Bell className="w-4 h-4 text-gray-400 hover:text-gray-900 transition-colors" />
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 h-[46px] hover:bg-gray-100 transition-colors"
            title={`تسجيل الخروج (${user?.email || ""})`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-gray-900 text-xs font-bold">
                {(user?.email || "A").charAt(0).toUpperCase()}
              </span>
            </div>
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
