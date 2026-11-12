
"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  costPrice: number;
  stock: number;
  price: number;
  images: string[];
};

type OrderItem = {
  productId: number;
  name: string;
  quantity: number;
  costPrice: number;
  price: number;
};

type Order = {
  id: number;
  customerName: string;
  phone: string;
  address: string;
  items: OrderItem[];
  total: number;
  profit: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  receipt: string;
  createdAt: string;
};

type PaymentMethod = {
  id: string;
  label: string;
  account_details: string;
  enabled: boolean;
};

const subcategories: Record<string, string[]> = {
  "إلكترونيات": ["موبايلات", "سماعات", "إكسسوارات موبايل"],
  "أزياء": ["ملابس", "شنط", "أحذية"],
  "المنزل": ["ديكور", "أدوات منزلية"],
  "إكسسوارات": ["سلاسل", "إنسيالات", "أساور", "حلقان", "غوايش", "خواتم"],
};

const money = (value: number) =>
  new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(value || 0);

export default function AdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editProductForm, setEditProductForm] = useState({
    name: "",
    category: "إكسسوارات",
    subcategory: "سلاسل",
    description: "",
    price: "",
    stock: "0",
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("israa2002mahmoud@gmail.com");
  const [password, setPassword] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("إكسسوارات");
  const [subcategory, setSubcategory] = useState("سلاسل");
  const [costPrice, setCostPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [price, setPrice] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [paymentLabel, setPaymentLabel] = useState("");
  const [paymentDetails, setPaymentDetails] = useState("");

  const [message, setMessage] = useState("");

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    setProducts((data || []).map((p) => ({
      id: Number(p.id),
      name: p.name,
      category: p.category,
      subcategory: p.subcategory || "",
      description: p.description || "",
      costPrice: Number(p.cost_price || 0),
      stock: Number(p.stock || 0),
      price: Number(p.price || 0),
      images: p.images || [],
    })));
  }

  async function loadPaymentMethods() {
    const { data, error } = await supabase
      .from("payment_settings")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    setPaymentMethods(data || []);
  }

  async function loadOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const formatted: Order[] = await Promise.all(
      (data || []).map(async (o) => {
        let receipt = "";

        if (o.receipt_url) {
          const { data: signed } = await supabase.storage
            .from("payment-receipts")
            .createSignedUrl(o.receipt_url, 3600);

          receipt = signed?.signedUrl || "";
        }

        return {
          id: Number(o.id),
          customerName: o.customer_name || "",
          phone: o.phone || "",
          address: o.address || "",
          items: Array.isArray(o.items) ? o.items : [],
          total: Number(o.total || 0),
          profit: Number(o.profit || 0),
          paymentMethod: o.payment_method || "",
          paymentStatus: o.payment_status || "pending",
          orderStatus: o.order_status || "pending",
          receipt,
          createdAt: o.created_at || "",
        };
      })
    );

    setOrders(formatted);
  }

  async function refreshAll() {
    try {
      setLoading(true);
      await Promise.all([
        loadProducts(),
        loadOrders(),
        loadPaymentMethods(),
      ]);
      setMessage("تم تحديث بيانات المتجر بنجاح ❤️");
    } catch (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      setMessage("اكتبي الإيميل وكلمة المرور.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) throw error;

      setIsLoggedIn(true);
      setPassword("");

      await Promise.all([
        loadProducts(),
        loadOrders(),
        loadPaymentMethods(),
      ]);

      setMessage("تم تسجيل الدخول وتحميل بيانات المتجر ❤️");
    } catch (error) {
      console.error(error);
      setIsLoggedIn(false);
      setMessage(
        error instanceof Error ? error.message : "تعذر تسجيل الدخول."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setMessage("اكتبي البريد الإلكتروني أولًا.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: "http://localhost:3002/reset-password",
      }
    );

    setMessage(
      error ? error.message : "تم إرسال رابط تغيير كلمة المرور إلى بريدك ❤️"
    );
  }

  async function addPaymentMethod() {
    if (!paymentLabel.trim() || !paymentDetails.trim()) {
      setMessage("اكتبي اسم وسيلة الدفع وبيانات التحويل.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("payment_settings")
        .insert({
          id: crypto.randomUUID(),
          label: paymentLabel.trim(),
          account_details: paymentDetails.trim(),
          enabled: true,
        })
        .select()
        .single();

      if (error) throw error;

      setPaymentMethods((old) => [...old, data]);
      setPaymentLabel("");
      setPaymentDetails("");
      setMessage("تمت إضافة وسيلة الدفع وتفعيلها بنجاح ❤️");
    } catch (error) {
      console.error(error);
      setMessage("تعذرت إضافة وسيلة الدفع. حاولي مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  async function togglePaymentMethod(method: PaymentMethod) {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("payment_settings")
        .update({ enabled: !method.enabled })
        .eq("id", method.id);

      if (error) throw error;

      setPaymentMethods((old) =>
        old.map((item) =>
          item.id === method.id
            ? { ...item, enabled: !method.enabled }
            : item
        )
      );

      setMessage(
        method.enabled
          ? "تم إيقاف وسيلة الدفع."
          : "تم تفعيل وسيلة الدفع."
      );
    } catch (error) {
      console.error(error);
      setMessage("تعذر تغيير حالة وسيلة الدفع.");
    } finally {
      setLoading(false);
    }
  }

  function handleImages(files: FileList | null) {
    if (!files) return;

    const remaining = 5 - images.length;

    if (remaining <= 0) {
      setMessage("مسموح بحد أقصى 5 صور.");
      return;
    }

    const selected = Array.from(files).slice(0, remaining);

    if (selected.some((file) => !file.type.startsWith("image/"))) {
      setMessage("اختاري صورًا فقط.");
      return;
    }

    const readers = selected.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject();
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readers)
      .then((newImages) => {
        setImages((old) => [...old, ...newImages].slice(0, 5));
        setMessage("تم تجهيز الصور.");
      })
      .catch(() => setMessage("حدث خطأ أثناء قراءة الصور."));
  }

  async function addProduct() {
    if (!name.trim()) {
      setMessage("اكتبي اسم المنتج.");
      return;
    }

    if (costPrice.trim() === "" || price.trim() === "") {
      setMessage("اكتبي سعر الشراء وسعر البيع.");
      return;
    }

    if (
      !Number.isFinite(Number(price)) ||
      Number(price) <= 0 ||
      !Number.isFinite(Number(costPrice)) ||
      Number(costPrice) < 0
    ) {
      setMessage("راجعي الأسعار المدخلة.");
      return;
    }

    if (!Number.isInteger(Number(stock)) || Number(stock) < 0) {
      setMessage("اكتبي كمية صحيحة لا تقل عن صفر.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("products")
        .insert({
          name: name.trim(),
          category,
          subcategory,
          cost_price: Number(costPrice),
          stock: Number(stock),
          price: Number(price),
          images,
          active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setProducts((old) => [{
        id: Number(data.id),
        name: data.name,
        category: data.category,
        subcategory: data.subcategory || "",
        description: data.description || "",
        costPrice: Number(data.cost_price || 0),
        stock: Number(data.stock || 0),
        price: Number(data.price || 0),
        images: data.images || [],
      }, ...old]);

      window.dispatchEvent(new Event("tota-products-updated"));

      setName("");
      setCostPrice("");
      setStock("0");
      setPrice("");
      setImages([]);

      setMessage("تم حفظ المنتج في قاعدة البيانات بنجاح ❤️");
    } catch (error) {
      console.error(error);
      setMessage("تعذر حفظ المنتج. راجعي صلاحيات قاعدة البيانات وحجم الصور.");
    } finally {
      setLoading(false);
    }
  }

  function startEditingProduct(product: Product) {
    setEditingProductId(product.id);
    setEditProductForm({
      name: product.name,
      category: product.category,
      subcategory: product.subcategory || (subcategories[product.category]?.[0] || ""),
      description: product.description || "",
      price: String(product.price),
      stock: String(product.stock),
    });
    setMessage("");
  }

  async function saveProductEdits(productId: number) {
    const productName = editProductForm.name.trim();
    const productPrice = Number(editProductForm.price);
    const productStock = Number(editProductForm.stock);

    if (!productName) {
      setMessage("اكتبي اسم المنتج.");
      return;
    }

    if (
      editProductForm.price.trim() === "" ||
      !Number.isFinite(productPrice) ||
      productPrice <= 0
    ) {
      setMessage("اكتبي سعر بيع صحيح أكبر من صفر.");
      return;
    }

    if (
      editProductForm.stock.trim() === "" ||
      !Number.isInteger(productStock) ||
      productStock < 0
    ) {
      setMessage("اكتبي كمية صحيحة لا تقل عن صفر.");
      return;
    }

    if (!subcategories[editProductForm.category]?.includes(editProductForm.subcategory)) {
      setMessage("اختاري قسمًا فرعيًا صحيحًا.");
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from("products")
        .update({
          name: productName,
          category: editProductForm.category,
          subcategory: editProductForm.subcategory,
          description: editProductForm.description.trim(),
          price: productPrice,
          stock: productStock,
        })
        .eq("id", productId);

      if (error) throw error;

      setProducts((old) =>
        old.map((product) =>
          product.id === productId
            ? {
                ...product,
                name: productName,
                category: editProductForm.category,
                subcategory: editProductForm.subcategory,
                description: editProductForm.description.trim(),
                price: productPrice,
                stock: productStock,
              }
            : product
        )
      );

      setEditingProductId(null);
      window.dispatchEvent(new Event("tota-products-updated"));
      setMessage("تم تعديل بيانات المنتج بنجاح ❤️");
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? `تعذر تعديل المنتج: ${error.message}`
          : "تعذر تعديل بيانات المنتج."
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct(id: number) {
    if (!window.confirm("هل تريدين حذف المنتج؟")) return;

    try {
      setLoading(true);

      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setProducts((old) => old.filter((p) => p.id !== id));
      window.dispatchEvent(new Event("tota-products-updated"));
      setMessage("تم حذف المنتج بنجاح.");
    } catch (error) {
      console.error(error);
      setMessage("تعذر حذف المنتج. قد يكون مرتبطًا بطلب سابق.");
    } finally {
      setLoading(false);
    }
  }

  async function reviewOrder(orderId: number, decision: "approve" | "reject") {
    const question =
      decision === "approve"
        ? "هل تأكدتِ من وصول التحويل وتريدين تأكيد الطلب؟"
        : "هل تريدين رفض الإيصال وإرجاع الكمية للمخزون؟";

    if (!window.confirm(question)) return;

    try {
      setLoading(true);

      const { error } = await supabase.rpc("admin_review_order", {
        p_order_id: orderId,
        p_decision: decision,
      });

      if (error) throw error;

      await Promise.all([loadOrders(), loadProducts()]);

      setMessage(
        decision === "approve"
          ? "تم قبول الإيصال وتأكيد الطلب ❤️"
          : "تم رفض الإيصال وإرجاع الكمية للمخزون."
      );
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error ? error.message : "تعذرت مراجعة الطلب."
      );
    } finally {
      setLoading(false);
    }
  }

  const pendingOrders = orders.filter(
    (o) => o.paymentStatus === "pending" || o.paymentStatus === "pending_review"
  );

  const confirmedOrders = orders.filter(
    (o) => o.orderStatus === "confirmed"
  );

  const rejectedOrders = orders.filter(
    (o) => o.orderStatus === "rejected"
  );

  const netProfit = confirmedOrders.reduce(
    (sum, order) => sum + order.profit,
    0
  );

  if (!isLoggedIn) {
    return (
      <main dir="rtl" style={pageStyle}>
        <div style={{
          maxWidth: 400,
          margin: "100px auto",
          padding: 25,
          background: "#24152f",
          borderRadius: 16,
        }}>
          <h1 style={{ color: "#ed70e8", textAlign: "center" }}>
            TOTA STORE
          </h1>

          <h2 style={{ textAlign: "center" }}>تسجيل دخول الإدارة</h2>

          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <button onClick={handleLogin} disabled={loading} style={buttonStyle}>
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>

          <button
            onClick={handleForgotPassword}
            style={{
              ...buttonStyle,
              background: "transparent",
              border: "1px solid #ed70e8",
              color: "#ed70e8",
            }}
          >
            نسيت كلمة المرور؟
          </button>

          {message && <p>{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" style={pageStyle}>
      <div style={{ maxWidth: 1000, margin: "auto" }}>
        <h1 style={{ color: "#ed70e8" }}>TOTA STORE</h1>
        <h2>لوحة إدارة المتجر</h2>
        <p style={{ color: "#c5b8ce" }}>
          إدارة المنتجات والطلبات ووسائل الدفع والأرباح
        </p>

        <button onClick={refreshAll} disabled={loading} style={buttonStyle}>
          تحديث كل بيانات المتجر
        </button>

        <section style={sectionStyle}>
          <h2>إحصائيات الطلبات</h2>

          <div style={statsGrid}>
            <Stat title="إجمالي الطلبات" value={orders.length} />
            <Stat title="الطلبات المؤكدة" value={confirmedOrders.length} />
            <Stat title="بانتظار الدفع أو المراجعة" value={pendingOrders.length} />
            <Stat title="الطلبات المرفوضة" value={rejectedOrders.length} />
            <Stat title="صافي الربح من الطلبات المؤكدة" value={money(netProfit)} />
          </div>
        </section>

        <section style={sectionStyle}>
          <h2>وسائل الدفع والتحويل</h2>
          <p style={{ color: "#cbb7d8" }}>
            أضيفي بيانات التحويل التي تريدين ظهورها للعملاء. لا تضيفي إلا الوسائل التي تستقبلين عليها الأموال فعلًا.
          </p>

          <label>اسم وسيلة الدفع</label>
          <input
            value={paymentLabel}
            onChange={(e) => setPaymentLabel(e.target.value)}
            placeholder="مثال: InstaPay أو محفظة Vodafone Cash"
            style={inputStyle}
          />

          <label>بيانات التحويل التي ستظهر للعميل</label>
          <textarea
            value={paymentDetails}
            onChange={(e) => setPaymentDetails(e.target.value)}
            placeholder={"اكتبي بيانات التحويل هنا، مثل رقم المحفظة أو عنوان InstaPay.\nيمكنك إضافة تعليمات التحويل للعميل."}
            rows={4}
            style={inputStyle}
          />

          <button
            onClick={addPaymentMethod}
            disabled={loading}
            style={buttonStyle}
          >
            {loading ? "جاري الحفظ..." : "+ إضافة وسيلة الدفع"}
          </button>

          <h3>وسائل الدفع الحالية</h3>

          {paymentMethods.length === 0 && (
            <p>لا توجد وسائل دفع مضافة حتى الآن.</p>
          )}

          {paymentMethods.map((method) => (
            <article key={method.id} style={orderStyle}>
              <h3>{method.label}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {method.account_details}
              </p>
              <p>
                الحالة: {method.enabled ? "مفعّلة" : "متوقفة"}
              </p>
              <button
                onClick={() => togglePaymentMethod(method)}
                disabled={loading}
                style={{
                  ...buttonStyle,
                  background: method.enabled ? "#a52b50" : "#398b61",
                }}
              >
                {method.enabled ? "إيقاف وسيلة الدفع" : "تفعيل وسيلة الدفع"}
              </button>
            </article>
          ))}
        </section>

        <section style={sectionStyle}>
          <h2>الطلبات وإيصالات التحويل</h2>

          {orders.length === 0 && <p>لا توجد طلبات حتى الآن.</p>}

          {orders.map((order) => (
            <article key={order.id} style={orderStyle}>
              <h3>طلب رقم: {order.id}</h3>
              <p>تاريخ الطلب: {order.createdAt ? new Date(order.createdAt).toLocaleString("ar-EG") : "غير محدد"}</p>
              <p>العميل: {order.customerName || "غير محدد"}</p>
              <p>الهاتف: {order.phone || "غير محدد"}</p>
              <p>العنوان: {order.address || "غير محدد"}</p>
              <p>وسيلة الدفع: {paymentMethods.find((m) => m.id === order.paymentMethod)?.label || order.paymentMethod || "غير محددة"}</p>

              <p>
                حالة الدفع:{" "}
                {order.paymentStatus === "pending_review"
                  ? "الإيصال في انتظار المراجعة"
                  : order.paymentStatus === "approved"
                    ? "تم قبول الدفع"
                    : order.paymentStatus === "rejected"
                      ? "مرفوض"
                      : "في انتظار التحويل"}
              </p>

              <h4>المنتجات:</h4>
              {order.items.map((item, index) => (
                <p key={index}>
                  {item.name} — الكمية: {item.quantity} — سعر البيع: {money(item.price)}
                </p>
              ))}

              <p>إجمالي الطلب: {money(order.total)}</p>

              {order.receipt ? (
                <div>
                  <p>إيصال التحويل:</p>
                  <a href={order.receipt} target="_blank" rel="noreferrer">
                    <img
                      src={order.receipt}
                      alt="إيصال التحويل"
                      style={{
                        maxWidth: 220,
                        maxHeight: 220,
                        objectFit: "contain",
                        borderRadius: 10,
                      }}
                    />
                  </a>
                </div>
              ) : (
                <p>لم يتم رفع إيصال التحويل بعد.</p>
              )}

              {order.paymentStatus === "pending_review" &&
                order.orderStatus === "pending" && (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      style={buttonStyle}
                      disabled={loading}
                      onClick={() => reviewOrder(order.id, "approve")}
                    >
                      قبول الإيصال وتأكيد الطلب
                    </button>

                    <button
                      style={{ ...buttonStyle, background: "#a52b50" }}
                      disabled={loading}
                      onClick={() => reviewOrder(order.id, "reject")}
                    >
                      رفض الإيصال
                    </button>
                  </div>
                )}
            </article>
          ))}
        </section>

        <section style={sectionStyle}>
          <h2>إضافة منتج جديد</h2>

          <label>اسم المنتج</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم المنتج"
            style={inputStyle}
          />

          <label>القسم الرئيسي</label>
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              setCategory(next);
              setSubcategory(subcategories[next][0]);
            }}
            style={inputStyle}
          >
            {Object.keys(subcategories).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <label>القسم الفرعي</label>
          <select
            value={subcategory}
            onChange={(e) => setSubcategory(e.target.value)}
            style={inputStyle}
          >
            {subcategories[category].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <label>سعر الشراء من التاجر (سري)</label>
          <input
            type="number"
            min="0"
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            placeholder="سعر الشراء"
            style={inputStyle}
          />

          <label>الكمية المتاحة في المخزون</label>
          <input
            type="number"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="الكمية المتاحة"
            style={inputStyle}
          />

          <label>سعر البيع للعميل</label>
          <input
            type="number"
            min="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="سعر البيع"
            style={inputStyle}
          />

          <p style={{ color: "#f28be9" }}>
            ربح القطعة:{" "}
            {costPrice !== "" && price !== ""
              ? money(Number(price) - Number(costPrice))
              : "سيظهر بعد إدخال الأسعار"}
          </p>

          <label>صور المنتج (حتى 5 صور)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              handleImages(e.target.files);
              e.target.value = "";
            }}
            style={inputStyle}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {images.map((src, index) => (
              <div key={index} style={{ position: "relative" }}>
                <img
                  src={src}
                  alt="صورة المنتج"
                  style={{
                    width: 85,
                    height: 85,
                    objectFit: "contain",
                    background: "white",
                    borderRadius: 10,
                  }}
                />
                <button
                  onClick={() => setImages((old) => old.filter((_, i) => i !== index))}
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    background: "#a21b55",
                    color: "white",
                    border: 0,
                    borderRadius: 20,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button onClick={addProduct} disabled={loading} style={buttonStyle}>
            {loading ? "جاري الحفظ..." : "+ حفظ وإضافة المنتج"}
          </button>
        </section>

        <section style={sectionStyle}>
          <h2>المنتجات ({products.length})</h2>

          {products.map((product) => (
            <article key={product.id} style={orderStyle}>
              <h3>{product.name}</h3>
              <p>{product.category} — {product.subcategory}</p>
              {product.description && (
                <p style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
              )}
              <p>الكمية المتاحة: {product.stock}</p>
              <p>سعر الشراء: {money(product.costPrice)}</p>
              <p>سعر البيع: {money(product.price)}</p>
              <p style={{ color: "#f28be9" }}>
                ربح القطعة: {money(product.price - product.costPrice)}
              </p>

              {editingProductId === product.id && (
                <div
                  style={{
                    background: "#352342",
                    border: "1px solid #654879",
                    borderRadius: 12,
                    padding: 16,
                    margin: "14px 0",
                  }}
                >
                  <h4 style={{ color: "#f28be9", marginTop: 0 }}>تعديل بيانات المنتج</h4>

                  <label>اسم المنتج</label>
                  <input
                    value={editProductForm.name}
                    onChange={(e) =>
                      setEditProductForm((old) => ({ ...old, name: e.target.value }))
                    }
                    style={inputStyle}
                  />

                  <label>القسم الرئيسي</label>
                  <select
                    value={editProductForm.category}
                    onChange={(e) => {
                      const nextCategory = e.target.value;
                      setEditProductForm((old) => ({
                        ...old,
                        category: nextCategory,
                        subcategory: subcategories[nextCategory][0],
                      }));
                    }}
                    style={inputStyle}
                  >
                    {Object.keys(subcategories).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>

                  <label>القسم الفرعي</label>
                  <select
                    value={editProductForm.subcategory}
                    onChange={(e) =>
                      setEditProductForm((old) => ({
                        ...old,
                        subcategory: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  >
                    {(subcategories[editProductForm.category] || []).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>

                  <label>وصف المنتج</label>
                  <textarea
                    value={editProductForm.description}
                    onChange={(e) =>
                      setEditProductForm((old) => ({
                        ...old,
                        description: e.target.value,
                      }))
                    }
                    rows={4}
                    style={inputStyle}
                  />

                  <label>سعر البيع للعميل</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={editProductForm.price}
                    onChange={(e) =>
                      setEditProductForm((old) => ({ ...old, price: e.target.value }))
                    }
                    style={inputStyle}
                  />

                  <label>الكمية المتاحة في المخزون</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editProductForm.stock}
                    onChange={(e) =>
                      setEditProductForm((old) => ({ ...old, stock: e.target.value }))
                    }
                    style={inputStyle}
                  />

                  <button
                    onClick={() => saveProductEdits(product.id)}
                    disabled={loading}
                    style={buttonStyle}
                  >
                    {loading ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </button>

                  <button
                    onClick={() => setEditingProductId(null)}
                    disabled={loading}
                    style={{
                      ...buttonStyle,
                      background: "#654879",
                    }}
                  >
                    إلغاء التعديل
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.images.map((src, index) => (
                  <img
                    key={index}
                    src={src}
                    alt={product.name}
                    style={{
                      width: 65,
                      height: 65,
                      objectFit: "contain",
                      background: "white",
                      borderRadius: 8,
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => startEditingProduct(product)}
                disabled={loading}
                style={{ ...buttonStyle, background: "#7136a8" }}
              >
                تعديل بيانات المنتج
              </button>

              <button
                onClick={() => deleteProduct(product.id)}
                disabled={loading}
                style={{ ...buttonStyle, background: "#a52b50" }}
              >
                حذف المنتج
              </button>
            </article>
          ))}
        </section>

        {message && <p style={{ color: "#f5a3ed" }}>{message}</p>}
      </div>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string | number }) {
  return (
    <div style={statStyle}>
      <p style={{ color: "#cbb7d8" }}>{title}</p>
      <strong style={{ color: "#f28be9", fontSize: 22 }}>{value}</strong>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  background: "#120d1b",
  color: "white",
  padding: 25,
  fontFamily: "Arial, sans-serif",
};

const sectionStyle: CSSProperties = {
  background: "#21172d",
  padding: 22,
  borderRadius: 16,
  margin: "25px 0",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 12,
};

const statStyle: CSSProperties = {
  background: "#281b35",
  padding: 18,
  borderRadius: 14,
};

const orderStyle: CSSProperties = {
  background: "#281b35",
  borderRadius: 14,
  padding: 18,
  marginBottom: 14,
};

const inputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 13,
  margin: "8px 0 18px",
  borderRadius: 9,
  border: "1px solid #654879",
  background: "#160f20",
  color: "white",
  fontSize: 16,
};

const buttonStyle: CSSProperties = {
  display: "block",
  width: "100%",
  padding: 14,
  marginTop: 14,
  border: 0,
  borderRadius: 10,
  background: "#b832a8",
  color: "white",
  fontSize: 16,
  fontWeight: "bold",
  cursor: "pointer",
};
