
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, Package, CheckCircle } from "lucide-react";

type OrderStatus = {
  order_id: number;
  payment_status: string;
  order_status: string;
  total: number;
  created_at: string;
};

type SavedOrder = {
  order_id: number;
  access_token: string;
};

const paymentLabels: Record<string, string> = {
  pending: "في انتظار إيصال التحويل",
  pending_review: "الإيصال قيد المراجعة",
  approved: "تم قبول الدفع",
  rejected: "تم رفض الإيصال",
};

const orderLabels: Record<string, string> = {
  pending: "في انتظار تأكيد الطلب",
  confirmed: "تم تأكيد الطلب",
  rejected: "تم رفض الطلب",
};

export default function TrackOrder() {
  const [orderId, setOrderId] = useState("");
  const [token, setToken] = useState("");
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [savedOrders, setSavedOrders] = useState<SavedOrder[]>([]);
  const [ordersStatuses, setOrdersStatuses] = useState<OrderStatus[]>([]);

  // تحميل الطلبات المحفوظة
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tota_saved_orders");

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          const validOrders = parsed.filter(
            (item): item is SavedOrder =>
              Number.isInteger(item.order_id) &&
              item.order_id > 0 &&
              typeof item.access_token === "string" &&
              item.access_token.trim() !== ""
          );

          setSavedOrders(validOrders);
        }
      }
    } catch {
      console.error("تعذر تحميل الطلبات المحفوظة");
    }
  }, []);

  // التحقق من حالة الطلبات المحفوظة
  useEffect(() => {
    let active = true;

    async function loadOrdersStatuses() {
      const results = await Promise.all(
        savedOrders.map(async (savedOrder) => {
          try {
            const { data, error } = await supabase.rpc(
              "get_customer_order_status",
              {
                p_order_id: savedOrder.order_id,
                p_access_token: savedOrder.access_token,
              }
            );

            if (error || !data) return null;

            return data as OrderStatus;
          } catch {
            return null;
          }
        })
      );

      if (active) {
        setOrdersStatuses(
          results.filter((item): item is OrderStatus => item !== null)
        );
      }
    }

    if (savedOrders.length > 0) {
      loadOrdersStatuses();
    } else {
      setOrdersStatuses([]);
    }

    return () => {
      active = false;
    };
  }, [savedOrders]);

  // البحث والتحقق وحفظ الطلب تلقائيًا
  async function searchOrder() {
    if (!orderId.trim() || !token.trim()) {
      setMessage("اكتبي رقم الطلب وكود المتابعة.");
      return;
    }

    if (!/^\d+$/.test(orderId.trim())) {
      setMessage("رقم الطلب غير صحيح.");
      return;
    }

    setLoading(true);
    setMessage("");
    setOrder(null);

    try {
      const { data, error } = await supabase.rpc(
        "get_customer_order_status",
        {
          p_order_id: Number(orderId),
          p_access_token: token.trim(),
        }
      );

      if (error) throw error;

      if (!data) {
        setMessage("لم نعثر على طلب بهذه البيانات. راجعي الرقم والكود.");
        return;
      }

      // حفظ الطلب بعد نجاح التحقق فقط
      const verifiedOrder: SavedOrder = {
        order_id: Number(orderId),
        access_token: token.trim(),
      };

      const saved = localStorage.getItem("tota_saved_orders");
      let existingOrders: SavedOrder[] = [];

      if (saved) {
        const parsed = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          existingOrders = parsed.filter(
            (item): item is SavedOrder =>
              Number.isInteger(item.order_id) &&
              item.order_id > 0 &&
              typeof item.access_token === "string" &&
              item.access_token.trim() !== ""
          );
        }
      }

      const updatedOrders = [
        ...existingOrders.filter(
          (item) => item.order_id !== verifiedOrder.order_id
        ),
        verifiedOrder,
      ];

      localStorage.setItem(
        "tota_saved_orders",
        JSON.stringify(updatedOrders)
      );

      setSavedOrders(updatedOrders);
      setOrder(data as OrderStatus);
      setLastUpdated(new Date());
      setMessage("تم التحقق من طلبك وحفظه في قائمة طلباتي السابقة ❤️");
    } catch (error) {
      console.error("تعذر التحقق من الطلب.");
      setMessage("حصل خطأ أثناء البحث. حاولي مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  const money = (value: number) =>
    new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "#f8f5fc",
        padding: "40px 16px",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          maxWidth: 550,
          margin: "auto",
          background: "white",
          borderRadius: 20,
          padding: 25,
          boxShadow: "0 10px 35px #24123e12",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 25 }}>
          <Package size={42} color="#6d35c8" />

          <h1 style={{ color: "#24123e", marginTop: 12 }}>
            متابعة طلباتي
          </h1>

          <p style={{ color: "#777181", marginTop: 8 }}>
            تابعي طلباتك السابقة أو استرجعي طلبًا باستخدام رقمه وكود المتابعة
          </p>
        </div>

        <label>رقم الطلب</label>

        <input
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          placeholder="مثال: 123"
          inputMode="numeric"
          style={fieldStyle}
        />

        <label style={{ display: "block", marginTop: 18 }}>
          كود المتابعة
        </label>

        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="أدخلي كود المتابعة"
          style={fieldStyle}
        />

        <button
          onClick={searchOrder}
          disabled={loading}
          style={{
            width: "100%",
            marginTop: 22,
            padding: 14,
            border: 0,
            borderRadius: 10,
            background: "#6d35c8",
            color: "white",
            fontSize: 16,
            fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          <Search size={17} style={{ verticalAlign: "middle" }} />
          {" "}{loading ? "جاري البحث..." : "متابعة الطلب"}
        </button>

        {message && (
          <p
            style={{
              color: message.startsWith("تم التحقق") ? "#29965a" : "#c0395a",
              marginTop: 18,
              lineHeight: 1.8,
            }}
          >
            {message}
          </p>
        )}

        {order && (
          <div style={orderCardStyle}>
            <h3 style={{ color: "#24123e" }}>
              <CheckCircle
                size={19}
                color="#29965a"
                style={{ verticalAlign: "middle" }}
              />
              {" "}تفاصيل طلبك
            </h3>

            <p>رقم الطلب: <b>{order.order_id}</b></p>
            <p>إجمالي الطلب: <b>{money(Number(order.total))}</b></p>

            <p>
              حالة الدفع:{" "}
              <b>
                {paymentLabels[order.payment_status] || order.payment_status}
              </b>
            </p>

            <p>
              حالة الطلب:{" "}
              <b>
                {orderLabels[order.order_status] || order.order_status}
              </b>
            </p>

            <p>
              تاريخ الطلب:{" "}
              <b>{new Date(order.created_at).toLocaleString("ar-EG")}</b>
            </p>

            {lastUpdated && (
              <p style={{ color: "#777181", fontSize: 12 }}>
                آخر تحديث: {lastUpdated.toLocaleTimeString("ar-EG")}
              </p>
            )}
          </div>
        )}

        <div style={{ marginTop: 35 }}>
          <h2
            style={{
              color: "#24123e",
              fontSize: 20,
              marginBottom: 18,
            }}
          >
            طلباتي السابقة
          </h2>

          {savedOrders.length === 0 ? (
            <p
              style={{
                color: "#777181",
                background: "#f8f5fc",
                padding: 16,
                borderRadius: 10,
                lineHeight: 1.8,
              }}
            >
              لا توجد طلبات محفوظة على هذا الجهاز حتى الآن.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {savedOrders.map((savedOrder) => {
                const status = ordersStatuses.find(
                  (item) => item.order_id === savedOrder.order_id
                );

                return (
                  <div
                    key={savedOrder.order_id}
                    style={{
                      ...orderCardStyle,
                      marginTop: 0,
                      border: "1px solid #e8def3",
                    }}
                  >
                    <h3 style={{ color: "#6d35c8", marginTop: 0 }}>
                      الطلب رقم #{savedOrder.order_id}
                    </h3>

                    <p style={{ wordBreak: "break-all" }}>
                      الكود السري: <b>{savedOrder.access_token}</b>
                    </p>

                    {status ? (
                      <>
                        <p>
                          حالة الدفع:{" "}
                          <b>
                            {paymentLabels[status.payment_status] ||
                              status.payment_status}
                          </b>
                        </p>

                        <p>
                          حالة الطلب:{" "}
                          <b>
                            {orderLabels[status.order_status] ||
                              status.order_status}
                          </b>
                        </p>

                        <p>
                          إجمالي الطلب:{" "}
                          <b>{money(Number(status.total))}</b>
                        </p>
                      </>
                    ) : (
                      <p style={{ color: "#c0395a", lineHeight: 1.8 }}>
                        تعذر التحقق من هذا الطلب. راجعي رقم الطلب والكود السري.
                      </p>
                    )}

                    <button
                      onClick={() => {
                        setOrderId(String(savedOrder.order_id));
                        setToken(savedOrder.access_token);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      style={{
                        width: "100%",
                        padding: 11,
                        border: 0,
                        borderRadius: 9,
                        background: "#eee5fa",
                        color: "#6d35c8",
                        fontWeight: 700,
                        cursor: "pointer",
                        marginTop: 8,
                      }}
                    >
                      متابعة هذا الطلب
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <a
          href="/"
          style={{
            display: "block",
            textAlign: "center",
            marginTop: 28,
            color: "#6d35c8",
            textDecoration: "none",
          }}
        >
          العودة للمتجر
        </a>
      </div>
    </main>
  );
}

const orderCardStyle: React.CSSProperties = {
  marginTop: 25,
  padding: 18,
  borderRadius: 12,
  background: "#f8f5fc",
  lineHeight: 2.2,
};

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 13,
  marginTop: 8,
  border: "1px solid #ddd3e8",
  borderRadius: 9,
  background: "#fff",
  color: "#191522",
  fontSize: 15,
  boxSizing: "border-box",
};
