import type { InsuranceApplication } from "@/lib/firestore-types";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface VisitorTrackingInfoProps {
  visitor: InsuranceApplication;
}

export function VisitorTrackingInfo({ visitor }: VisitorTrackingInfoProps) {
  const formatTimestamp = (timestamp: string | undefined) => {
    if (!timestamp) return "غير متوفر";

    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: ar });
    } catch {
      return "غير متوفر";
    }
  };

  return (
    <div className="space-y-4">
      {/* Online Status */}
      <div className="flex items-center gap-2">
        <div
          className={`w-3 h-3 rounded-full ${
            visitor.isOnline ? "bg-green-500" : "bg-gray-400"
          }`}
        />
        <span className="text-sm font-medium">
          {visitor.isOnline ? "متصل الآن" : "غير متصل"}
        </span>
        {visitor.lastActiveAt && (
          <span className="text-xs text-gray-500">
            ({formatTimestamp(visitor.lastActiveAt as any)})
          </span>
        )}
      </div>

      {/* Reference Number */}
      {visitor.referenceNumber && (
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-gray-600 mb-1">الرقم المرجعي</p>
          <p className="font-mono font-bold text-blue-600">
            {visitor.referenceNumber}
          </p>
        </div>
      )}

      {/* Device & Location Info */}
      <div className="grid grid-cols-2 gap-3">
        {visitor.country && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">البلد</p>
            <p className="font-semibold">{visitor.country}</p>
          </div>
        )}

        {visitor.deviceType && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">نوع الجهاز</p>
            <p className="font-semibold capitalize">{visitor.deviceType}</p>
          </div>
        )}

        {visitor.browser && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">المتصفح</p>
            <p className="font-semibold">{visitor.browser}</p>
          </div>
        )}

        {visitor.os && (
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">نظام التشغيل</p>
            <p className="font-semibold">{visitor.os}</p>
          </div>
        )}
      </div>

      {/* Session Info */}
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-600 mb-2">معلومات الجلسة</p>
        <div className="space-y-1 text-sm">
          {visitor.sessionStartAt && (
            <p>بدأ: {formatTimestamp(visitor.sessionStartAt)}</p>
          )}
          {visitor.createdAt && (
            <p>أول زيارة: {formatTimestamp(visitor.createdAt.toString())}</p>
          )}
        </div>
      </div>

      {/* Page Progress */}
      <div className="bg-gray-50 rounded-lg p-3">
        <p className="text-xs text-gray-600 mb-2">تقدم الصفحات</p>
        <div className="space-y-2">
          {visitor.homeCompletedAt && (
            <div className="flex items-center justify-between text-sm">
              <span>معلومات أساسية</span>
              <span className="text-green-600">✓</span>
            </div>
          )}
          {visitor.insurCompletedAt && (
            <div className="flex items-center justify-between text-sm">
              <span>بيانات التأمين</span>
              <span className="text-green-600">✓</span>
            </div>
          )}
          {visitor.comparCompletedAt && (
            <div className="flex items-center justify-between text-sm">
              <span>مقارنة العروض</span>
              <span className="text-green-600">✓</span>
            </div>
          )}
          {visitor.checkCompletedAt && (
            <div className="flex items-center justify-between text-sm">
              <span>الدفع والتحقق</span>
              <span className="text-green-600">✓</span>
            </div>
          )}
        </div>
      </div>

      {/* Block Status */}
      {visitor.is_blocked && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 font-semibold">⚠️ محظور</p>
        </div>
      )}
    </div>
  );
}
