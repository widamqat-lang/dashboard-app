"use client"

import { useState } from "react"
// Simple button component
const Button = ({ children, onClick, disabled, variant, className, ...props }: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
      variant === 'outline' 
        ? 'border-2 border-gray-300 hover:border-gray-400 bg-white text-gray-700'
        : variant === 'destructive'
        ? 'bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400'
        : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400'
    } ${disabled ? 'cursor-not-allowed opacity-50' : ''} ${className || ''}`}
    {...props}
  >
    {children}
  </button>
)
import type { InsuranceApplication } from "@/lib/firestore-types"
import { updateApplication } from "@/lib/firebase-services"

interface VisitorBlockControlProps {
  visitor: InsuranceApplication
}

export function VisitorBlockControl({ visitor }: VisitorBlockControlProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  
  const handleToggleBlock = async () => {
    if (!visitor.id) return
    
    const confirmMessage = visitor.is_blocked
      ? "هل أنت متأكد من إلغاء حظر هذا الزائر?"
      : "هل أنت متأكد من حظر هذا الزائر؟ لن يتمكن من الوصول إلى الخدمة."
    
    if (!confirm(confirmMessage)) return
    
    setIsProcessing(true)
    
    try {
      await updateApplication(visitor.id, {
        is_blocked: !visitor.is_blocked
      })
      
      alert(visitor.is_blocked ? "تم إلغاء الحظر بنجاح" : "تم الحظر بنجاح")
    } catch (error) {
      console.error("Error toggling block:", error)
      alert("حدث خطأ أثناء تحديث حالة الحظر")
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="border-t pt-4">
      <Button
        onClick={handleToggleBlock}
        disabled={isProcessing}
        variant={visitor.is_blocked ? "default" : "destructive"}
        className="w-full"
      >
        {isProcessing
          ? "جاري التحديث..."
          : visitor.is_blocked
          ? "إلغاء الحظر"
          : "حظر الزائر"}
      </Button>
      
      {visitor.is_blocked && (
        <p className="text-xs text-red-600 mt-2 text-center">
          هذا الزائر محظور حالياً ولا يمكنه الوصول إلى الخدمة
        </p>
      )}
    </div>
  )
}
