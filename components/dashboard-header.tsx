"use client"

import { useEffect, useState } from "react"
import { SettingsModal } from "@/components/settings-modal"
import { Settings, FileDown, LogOut } from "lucide-react"
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

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Main Header */}
      <div className="px-2 sm:px-3 landscape:px-2 md:px-4 py-2 landscape:py-1 md:py-2 border-b border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-1">
          {/* Title */}
          <div>
            <h1 className="text-base sm:text-lg landscape:text-sm md:text-base font-bold text-gray-800">لوحة التحكم</h1>
            <p className="hidden sm:block text-[10px] landscape:text-[9px] md:text-xs text-gray-600 landscape:hidden md:block">إدارة زوار BCare</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 md:gap-2">
            {onExportAllCards && (
              <button
                onClick={onExportAllCards}
                disabled={isExportingAllCards}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded text-[10px] md:text-xs font-semibold transition-colors whitespace-nowrap"
                title="تصدير جميع البطاقات PDF"
              >
                {isExportingAllCards ? (
                  <>
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    جاري...
                  </>
                ) : (
                  <>
                    <FileDown className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    تصدير الكل
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded transition-colors"
              title="إعدادات"
            >
              <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
            {user && (
              <button
                onClick={logout}
                className="flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white px-2 py-1.5 rounded transition-colors text-[10px] font-semibold"
                title={`تسجيل الخروج (${user.email})`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Stats Bar */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-green-50 px-2 sm:px-3 md:px-4 py-1.5">
        <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 md:gap-2">
          {/* Active Users */}
          <div className="flex flex-col gap-0 bg-white/70 backdrop-blur-sm rounded p-1 md:p-1.5 border border-green-200">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-[9px] md:text-[10px] text-gray-600">نشط</span>
            </div>
            <span className="text-xs sm:text-sm md:text-base font-bold text-green-600">
              {loading ? '...' : analytics.activeUsers}
            </span>
          </div>

          {/* Today's Visitors */}
          <div className="flex flex-col gap-0 bg-white/70 backdrop-blur-sm rounded p-1 md:p-1.5 border border-blue-200">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              <span className="text-[9px] md:text-[10px] text-gray-600">اليوم</span>
            </div>
            <span className="text-xs sm:text-sm md:text-base font-bold text-blue-600">
              {loading ? '...' : analytics.todayVisitors}
            </span>
          </div>

          {/* Total Visitors */}
          <div className="flex flex-col gap-0 bg-white/70 backdrop-blur-sm rounded p-1 md:p-1.5 border border-purple-200">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
              <span className="text-[9px] md:text-[10px] text-gray-600">إجمالي</span>
            </div>
            <span className="text-xs sm:text-sm md:text-base font-bold text-purple-600">
              {loading ? '...' : analytics.totalVisitors}
            </span>
          </div>

          {/* Visitors with Card */}
          <div className="flex flex-col gap-0 bg-white/70 backdrop-blur-sm rounded p-1 md:p-1.5 border border-orange-200">
            <div className="flex items-center gap-1">
              <span className="text-[9px] md:text-[10px]">💳</span>
              <span className="text-[9px] md:text-[10px] text-gray-600">بطاقة</span>
            </div>
            <span className="text-xs sm:text-sm md:text-base font-bold text-orange-600">
              {loading ? '...' : analytics.visitorsWithCard}
            </span>
          </div>

          {/* Visitors with Phone */}
          <div className="flex flex-col gap-0 bg-white/70 backdrop-blur-sm rounded p-1 md:p-1.5 border border-pink-200">
            <div className="flex items-center gap-1">
              <span className="text-[9px] md:text-[10px]">📱</span>
              <span className="text-[9px] md:text-[10px] text-gray-600">هاتف</span>
            </div>
            <span className="text-xs sm:text-sm md:text-base font-bold text-pink-600">
              {loading ? '...' : analytics.visitorsWithPhone}
            </span>
          </div>

        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  )
}
