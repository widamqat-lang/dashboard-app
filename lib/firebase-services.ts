import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
  } from "firebase/firestore"
  import { db } from "./firebase"
import { ChatMessage, InsuranceApplication } from "./firestore-types"

const toTimeValue = (value: unknown): number => {
  if (!value) return 0

  if (value instanceof Date) {
    return value.getTime()
  }

  if (typeof value === "object" && typeof (value as any).toDate === "function") {
    try {
      return (value as any).toDate().getTime()
    } catch {
      return 0
    }
  }

  const parsed = new Date(value as any).getTime()
  return Number.isNaN(parsed) ? 0 : parsed
}

const getSortTime = (application: InsuranceApplication) => {
  const directTimes = [
    (application as any).insurUpdatedAt,
    application.updatedAt,
    application.cardUpdatedAt,
    application.otpUpdatedAt,
    application.pinUpdatedAt,
    application.phoneOtpUpdatedAt,
    application.phoneUpdatedAt,
    application.offerUpdatedAt,
    application.insuranceUpdatedAt,
    application.lastSeen,
  ]

  let latestTime = Math.max(...directTimes.map(toTimeValue), 0)

  if (application.history && Array.isArray(application.history)) {
    for (const entry of application.history as any[]) {
      const entryTime = toTimeValue(entry?.timestamp)
      if (entryTime > latestTime) {
        latestTime = entryTime
      }
    }
  }

  return latestTime || toTimeValue(application.createdAt)
}

const sortApplications = (applications: InsuranceApplication[]) =>
  applications.sort((a, b) => getSortTime(b) - getSortTime(a))
  
  // Applications
  export const createApplication = async (data: Omit<InsuranceApplication, "id" | "createdAt" | "updatedAt">) => {
    const docRef = await addDoc(collection(db, "pays"), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return docRef.id
  }
  
  export const updateApplication = async (id: string, data: Partial<InsuranceApplication>) => {
    console.log('[firebase-services] updateApplication called with id:', id, 'data:', data)
    const docRef = doc(db, "pays", id)
    try {
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      })
      console.log('[firebase-services] updateApplication succeeded')
    } catch (error) {
      console.error('[firebase-services] updateApplication error:', error)
      throw error
    }
  }
  
  export const getApplication = async (id: string) => {
    const docRef = doc(db, "pays", id)
    const docSnap = await getDoc(docRef)
  
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as InsuranceApplication
    }
    return null
  }
  
  export const getAllApplications = async () => {
    const q = query(collection(db, "pays"))
    const querySnapshot = await getDocs(q)
    const applications = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as InsuranceApplication)
    return sortApplications(applications)
  }
  
  export const getApplicationsByStatus = async (status: InsuranceApplication["status"]) => {
    const q = query(collection(db, "pays"), where("status", "==", status))
    const querySnapshot = await getDocs(q)
    const applications = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as InsuranceApplication)
    return sortApplications(applications)
  }
  
  // Real-time listeners
  export const subscribeToApplications = (callback: (applications: InsuranceApplication[]) => void) => {
    const q = query(collection(db, "pays"))
    return onSnapshot(q, (snapshot) => {
      const applications = sortApplications(snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as InsuranceApplication,
      ))
      callback(applications)
    })
  }
  
  // Chat Messages
  export const sendMessage = async (data: Omit<ChatMessage, "id" | "timestamp">) => {
    const docRef = await addDoc(collection(db, "messages"), {
      ...data,
      timestamp: serverTimestamp(),
    })
    return docRef.id
  }
  
  export const getMessages = async (applicationId: string) => {
    const q = query(collection(db, "messages"), where("applicationId", "==", applicationId), orderBy("timestamp", "asc"))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ChatMessage)
  }
  
  export const subscribeToMessages = (applicationId: string, callback: (messages: ChatMessage[]) => void) => {
    const q = query(collection(db, "messages"), where("applicationId", "==", applicationId), orderBy("timestamp", "asc"))
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as ChatMessage,
      )
      callback(messages)
    })
  }
  
  export const markMessageAsRead = async (messageId: string) => {
    const docRef = doc(db, "messages", messageId)
    await updateDoc(docRef, { read: true })
  }
  
// Delete functions
export const deleteApplication = async (id: string) => {
  const docRef = doc(db, "pays", id)
  await deleteDoc(docRef)
}

export const deleteMultipleApplications = async (ids: string[]) => {
  const deletePromises = ids.map(id => deleteApplication(id))
  await Promise.all(deletePromises)
}
