"use client";

import { useEffect, useState } from "react";
import { ref, onValue, get } from "firebase/database";
import { collection, getDocs } from "firebase/firestore";
import { database, db } from "@/lib/firebase";

interface PresenceEntry {
  id: string;
  online: boolean;
  lastSeen: number;
  lastSeenAgo: string;
  raw: any;
}

interface PaysDoc {
  id: string;
  ownerName?: string;
  lastActiveAt?: any;
  lastSeen?: any;
  currentStep?: any;
}

function toMs(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && typeof (value as any).toDate === "function") {
    try {
      return (value as any).toDate().getTime();
    } catch {
      return 0;
    }
  }
  const parsed = new Date(value as any).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function timeAgo(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return "مستقبلي";
  if (diff < 1000) return "الآن";
  if (diff < 60000) return `منذ ${Math.floor(diff / 1000)} ثانية`;
  if (diff < 3600000) return `منذ ${Math.floor(diff / 60000)} دقيقة`;
  return `منذ ${Math.floor(diff / 3600000)} ساعة`;
}

export default function PresenceDebugPage() {
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [paysDocs, setPaysDocs] = useState<PaysDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadPays = async () => {
    const snap = await getDocs(collection(db, "pays"));
    const docs = snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ownerName: data.ownerName || data.name || "",
        lastActiveAt: data.lastActiveAt,
        lastSeen: data.lastSeen,
        currentStep: data.currentStep || data.redirectPage || data.currentPage,
      };
    });
    setPaysDocs(docs);
  };

  useEffect(() => {
    const presenceRef = ref(database, "presence");

    const unsubscribe = onValue(
      presenceRef,
      (snapshot) => {
        const val = snapshot.val() || {};
        const entries: PresenceEntry[] = Object.entries(val).map(([id, data]) => {
          const d = data as any;
          const lastSeen = typeof d?.lastSeen === "number" ? d.lastSeen : toMs(d?.lastSeen);
          return {
            id,
            online: Boolean(d?.online),
            lastSeen,
            lastSeenAgo: timeAgo(lastSeen),
            raw: d,
          };
        });
        entries.sort((a, b) => b.lastSeen - a.lastSeen);
        setPresence(entries);
        setLoading(false);
      },
      (err) => {
        setError(`فشل قراءة عقدة presence: ${err.message}`);
        setLoading(false);
      }
    );

    loadPays().catch((e) => setError(`فشل قراءة pays: ${e.message}`));

    return () => unsubscribe();
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const snap = await get(ref(database, "presence"));
      const val = snap.val();
      console.log("[debug] raw presence:", val);
      const entries: PresenceEntry[] = Object.entries(val || {}).map(([id, data]) => {
        const d = data as any;
        const lastSeen = typeof d?.lastSeen === "number" ? d.lastSeen : toMs(d?.lastSeen);
        return {
          id,
          online: Boolean(d?.online),
          lastSeen,
          lastSeenAgo: timeAgo(lastSeen),
          raw: d,
        };
      });
      entries.sort((a, b) => b.lastSeen - a.lastSeen);
      setPresence(entries);
      await loadPays();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const presenceIds = new Set(presence.map((p) => p.id));
  const paysIds = new Set(paysDocs.map((p) => p.id));
  const matched = paysDocs.filter((p) => presenceIds.has(p.id));
  const presenceWithoutPays = presence.filter((p) => !paysIds.has(p.id));
  const paysWithoutPresence = paysDocs.filter((p) => !presenceIds.has(p.id));
  const onlineInPresence = presence.filter((p) => p.online);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-3 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            🔍 تشخيص نظام الـ Presence
          </h1>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-50"
          >
            {refreshing ? "جاري..." : "تحديث"}
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="مفاتيح presence" value={presence.length} color="blue" />
          <StatCard label="online=true" value={onlineInPresence.length} color="green" />
          <StatCard label="مستندات pays" value={paysDocs.length} color="purple" />
          <StatCard label="متطابقة (pays ∩ presence)" value={matched.length} color="amber" />
          <StatCard label="pays بدون presence" value={paysWithoutPresence.length} color="red" />
        </div>

        {/* Diagnosis banner */}
        {presence.length === 0 && (
          <div className="mb-6 bg-red-50 border-r-4 border-red-500 p-4 rounded">
            <h3 className="font-bold text-red-800 mb-1">🚫 عقدة presence فارغة أو غير موجودة</h3>
            <p className="text-sm text-red-700">
              موقع العملاء <strong>لا يكتب إلى عقدة presence</strong> أصلاً، أو يكتب إلى قاعدة بيانات
              Realtime Database مختلفة، أو القواعد (rules) تمنع القراءة/الكتابة. هذا هو السبب الجذري لظهور
              الزوار كـ &quot;غير متصل&quot;.
            </p>
          </div>
        )}
        {presence.length > 0 && matched.length === 0 && (
          <div className="mb-6 bg-amber-50 border-r-4 border-amber-500 p-4 rounded">
            <h3 className="font-bold text-amber-800 mb-1">⚠ عدم تطابق في المعرّفات</h3>
            <p className="text-sm text-amber-700">
              توجد بيانات presence ({presence.length} مفتاح) لكن <strong>لا يوجد أي تطابق</strong> مع
              معرفات مستندات pays. موقع العملاء يكتب presence بمفتاح <strong>ليس هو document ID في pays</strong>.
              تحقّق من أن موقع العملاء يستخدم نفس الـ ID المُعاد من إنشاء مستند pays.
            </p>
          </div>
        )}
        {presence.length > 0 && matched.length > 0 && (
          <div className="mb-6 bg-green-50 border-r-4 border-green-500 p-4 rounded">
            <h3 className="font-bold text-green-800 mb-1">✅ يوجد تطابق</h3>
            <p className="text-sm text-green-700">
              عقدة presence تعمل ويوجد {matched.length} زائر متطابق. لو كان الزائر لا يظهر &quot;متصل&quot; رغم
              وجوده هنا بـ online=true، فالمشكلة في لوحة التحكم (تم إصلاحها في هذا التحديث).
            </p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Presence entries */}
          <Section title={`عقدة presence (${presence.length})`}>
            {presence.length === 0 ? (
              <Empty text="لا توجد بيانات في عقدة presence" />
            ) : (
              <div className="space-y-2">
                {presence.map((p) => (
                  <div
                    key={p.id}
                    className={`p-2 rounded border text-xs ${
                      p.online ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold break-all">{p.id}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold ${
                          p.online ? "bg-green-500 text-white" : "bg-gray-400 text-white"
                        }`}
                      >
                        {p.online ? "🟢 online" : "⚫ offline"}
                      </span>
                    </div>
                    <div className="mt-1 text-gray-600">
                      lastSeen: {p.lastSeenAgo} {paysIds.has(p.id) ? "· ✓ في pays" : "· ✗ ليس في pays"}
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-gray-500">البيانات الخام</summary>
                      <pre className="mt-1 bg-gray-100 p-2 rounded overflow-auto text-[10px]" dir="ltr">
                        {JSON.stringify(p.raw, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Pays docs */}
          <Section title={`مستندات pays (${paysDocs.length})`}>
            {paysDocs.length === 0 ? (
              <Empty text="لا توجد مستندات في pays" />
            ) : (
              <div className="space-y-2">
                {paysDocs.map((p) => {
                  const lastMs = toMs(p.lastActiveAt ?? p.lastSeen);
                  const hasPresence = presenceIds.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className={`p-2 rounded border text-xs ${
                        hasPresence ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold break-all">{p.id}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold ${
                            hasPresence ? "bg-green-500 text-white" : "bg-red-400 text-white"
                          }`}
                        >
                          {hasPresence ? "✓ له presence" : "✗ بدون presence"}
                        </span>
                      </div>
                      <div className="mt-1 text-gray-600">
                        {p.ownerName || "بدون اسم"} · صفحة: {String(p.currentStep || "—")}
                      </div>
                      <div className="text-gray-500">lastActive: {timeAgo(lastMs)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Presence keys not in pays */}
        {presenceWithoutPays.length > 0 && (
          <div className="mt-4">
            <Section title={`⚠ مفاتيح presence غير موجودة في pays (${presenceWithoutPays.length})`}>
              <div className="space-y-1">
                {presenceWithoutPays.map((p) => (
                  <div key={p.id} className="bg-amber-50 border border-amber-200 p-2 rounded text-xs font-mono break-all">
                    {p.id}
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-2">
                هذه مفاتيح يكتبها موقع العملاء لكنها لا تطابق أي مستند pays — غالباً يستخدم معرّفاً مختلفاً
                (مثل sessionId أو fingerprint) بدلاً من document ID.
              </p>
            </Section>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
          <p className="font-bold mb-1">كيف تُحدّد المشكلة من هذه الصفحة:</p>
          <ul className="list-disc pr-4 space-y-1">
            <li><strong>presence فارغة</strong> → موقع العملاء لا يكتب أصلاً (أو database/قواعد مختلفة).</li>
            <li><strong>presence بها بيانات لكن بلا تطابق مع pays</strong> → موقع العملاء يستخدم معرّفاً خاطئاً.</li>
            <li><strong>الزائر متطابق و online=true</strong> → المشكلة كانت في لوحة التحكم وتم إصلاحها.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "green" | "purple" | "amber" | "red";
}) {
  const colors = {
    blue: "border-blue-200 text-blue-700",
    green: "border-green-200 text-green-700",
    purple: "border-purple-200 text-purple-700",
    amber: "border-amber-200 text-amber-700",
    red: "border-red-200 text-red-700",
  };
  return (
    <div className={`bg-white rounded-lg p-3 border ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      </div>
      <div className="p-3 max-h-[400px] overflow-y-auto">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-center py-6 text-gray-400 text-sm">{text}</div>;
}
