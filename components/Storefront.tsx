
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, ShoppingBag, Heart, Menu, ArrowLeft, Sparkles,
  Plus, Minus, X, Upload, CheckCircle, Loader2, Eye
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Product = {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  images: string[];
  stock: number;
};

type PaymentMethod = {
  id: string;
  label: string;
  account_details: string;
  enabled: boolean;
};

type ShippingGovernorate = {
  governorate: string;
  shipping_fee: number;
};

type CreatedOrder = {
  order_id: number;
  access_token: string;
  shipping_fee?: number;
  total?: number;
  coupon_code?: string | null;
  coupon_discount?: number;
};

type CouponPreview = {
  valid: boolean;
  coupon_id?: number;
  code?: string;
  discount_type?: "fixed" | "percentage";
  discount_value?: number;
  discount_amount?: number;
  total_after_discount?: number;
  remaining_uses?: number;
  message?: string;
};

type StoreCategory = { name: string; image: string; subcategories: Array<{ name: string; image: string }> };

type PublicStoreSettings = {
  homepage_sections?: { enabled?: boolean; categories?: StoreCategory[] };
  top_bar?: { enabled?: boolean; text?: string; background?: string; text_color?: string };
  hero_banner?: { enabled?: boolean; title?: string; description?: string; image?: string; images?: string[]; button_text?: string; button_link?: string };
  promotions?: { enabled?: boolean; items?: Array<{ title: string; description?: string }> };
  about?: { enabled?: boolean; title?: string; description?: string };
  footer?: { enabled?: boolean; description?: string; whatsapp_number?: string; instagram_url?: string; tiktok_url?: string };
};

const DEFAULT_CATEGORIES: StoreCategory[] = [
  { name: "إلكترونيات", image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=900&q=85", subcategories: [{ name: "موبايلات", image: "" }, { name: "سماعات", image: "" }, { name: "إكسسوارات موبايل", image: "" }] },
  { name: "أزياء", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=85", subcategories: [{ name: "ملابس", image: "" }, { name: "شنط", image: "" }, { name: "أحذية", image: "" }] },
  { name: "المنزل", image: "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=85", subcategories: [{ name: "ديكور", image: "" }, { name: "أدوات منزلية", image: "" }] },
  { name: "إكسسوارات", image: "https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=900&q=85", subcategories: [{ name: "سلاسل", image: "" }, { name: "إنسيالات", image: "" }, { name: "أساور", image: "" }, { name: "حلقان", image: "" }, { name: "غوايش", image: "" }, { name: "خواتم", image: "" }] },
];


const toEnglishDigits = (value: string | number) =>
  String(value).replace(/[٠-٩۰-۹]/g, (digit) => {
    const arabic = "٠١٢٣٤٥٦٧٨٩";
    const persian = "۰۱۲۳۴۵۶۷۸۹";
    const index = arabic.indexOf(digit);
    return String(index >= 0 ? index : persian.indexOf(digit));
  });

const money = (value: number) =>
  `EGP ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}`;

const getWhatsAppUrl = (value?: string) => {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  const international = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
};

const getInstagramUrl = (value?: string) => {
  const account = (value || "").trim();
  if (!account) return "";
  if (/^https?:\/\//i.test(account)) return account;
  return `https://www.instagram.com/${account.replace(/^@/, "").replace(/^\/+|\/+$/g, "")}/`;
};

const getTikTokUrl = (value?: string) => {
  const account = (value || "").trim();
  if (!account) return "";
  if (/^https?:\/\//i.test(account)) return account;
  return `https://www.tiktok.com/@${account.replace(/^@/, "").replace(/^\/+|\/+$/g, "")}`;
};

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
const [bestsellerSales, setBestsellerSales] = useState<Record<number, number>>({});
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippingGovernorates, setShippingGovernorates] = useState<ShippingGovernorate[]>([]);
  const [shippingGovernorate, setShippingGovernorate] = useState("");
  const [storeSettings, setStoreSettings] = useState<PublicStoreSettings>({});
  const heroImages = storeSettings.hero_banner?.images?.length
    ? storeSettings.hero_banner.images
    : storeSettings.hero_banner?.image ? [storeSettings.hero_banner.image] : [];
  useEffect(() => {
    setHeroIndex(0);
    if (heroImages.length < 2) return;
    const timer = window.setInterval(() => setHeroIndex((current) => (current + 1) % heroImages.length), 5000);
    return () => window.clearInterval(timer);
  }, [heroImages.length]);
  const [category, setCategory] = useState("الكل");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [productImageIndexes, setProductImageIndexes] = useState<Record<number, number>>({});
  const [lightbox, setLightbox] = useState<{ name: string; images: string[]; index: number } | null>(null);
  const storeCategories = storeSettings.homepage_sections?.categories ?? DEFAULT_CATEGORIES;
  const activeCategory = storeCategories.find((item) => item.name === category);
  const [heroIndex, setHeroIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
const [order, setOrder] = useState<CreatedOrder | null>(null);
const [savedOrder, setSavedOrder] = useState<CreatedOrder | null>(null);
const [receipt, setReceipt] = useState<File | null>(null);
const [loading, setLoading] = useState(false);
const [message, setMessage] = useState("");
const [orderCompleted, setOrderCompleted] = useState(false);

useEffect(() => {
  try {
    const savedFavorites = localStorage.getItem("tota_favorite_products");
    if (savedFavorites) {
      const parsed = JSON.parse(savedFavorites);
      if (Array.isArray(parsed)) {
        setFavoriteIds(parsed.map(Number).filter((id) => Number.isFinite(id)));
      }
    }
  } catch {
    localStorage.removeItem("tota_favorite_products");
  }
}, []);

function toggleFavorite(productId: number) {
  setFavoriteIds((current) => {
    const next = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    localStorage.setItem("tota_favorite_products", JSON.stringify(next));
    return next;
  });
}

useEffect(() => {
  try {
    const savedOrders = localStorage.getItem("tota_saved_orders");

    if (savedOrders) {
      const parsed = JSON.parse(savedOrders);

      if (Array.isArray(parsed)) {
        const validOrders = parsed.filter(
          (item): item is CreatedOrder =>
            Number.isInteger(item?.order_id) &&
            typeof item?.access_token === "string" &&
            item.access_token.length > 0
        );

        if (validOrders.length > 0) {
          setSavedOrder(validOrders[validOrders.length - 1]);
        }
      }
    } else {
      const oldSaved = localStorage.getItem("tota_saved_order");

      if (oldSaved) {
        const parsed = JSON.parse(oldSaved) as CreatedOrder;

        if (parsed.order_id && parsed.access_token) {
          localStorage.setItem(
            "tota_saved_orders",
            JSON.stringify([parsed])
          );
          setSavedOrder(parsed);
        }
      }
    }
  } catch {
    console.error("تعذر تحميل الطلبات المحفوظة.");
  }
}, []);

  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowRight") setLightbox((current) => current ? { ...current, index: (current.index - 1 + current.images.length) % current.images.length } : null);
      if (event.key === "ArrowLeft") setLightbox((current) => current ? { ...current, index: (current.index + 1) % current.images.length } : null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightbox]);

  useEffect(() => {
    async function loadData() {
      const [
        productsResult,
        paymentsResult,
        shippingResult,
        settingsResult,
        bestsellerResult,
      ] = await Promise.all([
  supabase
    .from("products")
    .select("id, name, category, subcategory, price, images, stock")
    .eq("active", true)
    .order("created_at", { ascending: false }),

  supabase
    .from("payment_settings")
    .select("id, label, account_details, enabled")
    .eq("enabled", true),

  supabase.rpc("get_shipping_governorates"),

  supabase.rpc("get_public_store_settings"),

  supabase.rpc("get_public_bestseller_sales"),
]);
      if (productsResult.error) {
        console.error("خطأ تحميل المنتجات:", productsResult.error.message);
      } else {
        setProducts(
          (productsResult.data || []).map((p) => ({
            id: Number(p.id),
            name: p.name,
            category: p.category,
            subcategory: p.subcategory || "",
            price: Number(p.price),
            images: p.images || [],
            stock: Number(p.stock || 0),
          }))
        );
      }
if (bestsellerResult.error) {
  console.error("خطأ تحميل الأكثر مبيعًا:", bestsellerResult.error.message);
} else {
  const salesMap: Record<number, number> = {};

  for (const row of bestsellerResult.data || []) {
    salesMap[Number(row.product_id)] = Number(row.units_sold);
  }

  setBestsellerSales(salesMap);
}
      if (paymentsResult.error) {
        console.error("خطأ تحميل وسائل الدفع:", paymentsResult.error.message);
      } else {
        setPaymentMethods(paymentsResult.data || []);
      }
      if (shippingResult.error) {
        console.error("خطأ تحميل محافظات الشحن:", shippingResult.error.message);
      } else {
        setShippingGovernorates(
          (shippingResult.data || []).map((item: ShippingGovernorate) => ({
            governorate: item.governorate,
            shipping_fee: Number(item.shipping_fee),
          }))
        );
      }
      if (settingsResult.error) {
        console.error("خطأ تحميل إعدادات المتجر:", settingsResult.error.message);
      } else {
        const mapped: PublicStoreSettings = {};
        for (const row of settingsResult.data || []) {
          (mapped as any)[row.setting_key] = row.setting_value || {};
        }
        setStoreSettings(mapped);
      }
    }

    loadData();
  }, []);

  const visibleProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "الكل" || p.category === category) &&
          (!selectedSubcategory || p.subcategory === selectedSubcategory) &&
          (!favoritesOnly || favoriteIds.includes(p.id)) &&
          (p.name.includes(query.trim()) || p.subcategory.includes(query.trim()))
      ),
    [products, category, selectedSubcategory, query, favoritesOnly, favoriteIds]
  );

  // المنتجات الأحدث تظهر أولاً لأن استعلام المنتجات مرتب بتاريخ الإضافة تنازلياً.
  const newArrivalProducts = products.slice(0, 4);
  // واجهة قسم الأكثر مبيعاً جاهزة؛ ترتيبها بالمبيعات الفعلية يحتاج ربط عدد الوحدات المباعة من الطلبات.
  const bestsellerPreviewProducts = [...products]
  .filter((p) => (bestsellerSales[p.id] || 0) > 0)
  .sort((a, b) => (bestsellerSales[b.id] || 0) - (bestsellerSales[a.id] || 0))
  .slice(0, 4);

  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  const total = products.reduce(
    (sum, p) => sum + p.price * (cart[p.id] || 0),
    0
  );

  const selectedShipping = shippingGovernorates.find(
    (item) => item.governorate === shippingGovernorate
  );

  const shippingFee = selectedShipping?.shipping_fee ?? 0;
  const couponDiscount = couponPreview?.valid ? Number(couponPreview.discount_amount || 0) : 0;
  const grandTotal = Math.max(0, total - couponDiscount) + shippingFee;

  async function applyCoupon() {
    if (!couponCode.trim()) {
      setMessage("اكتبي كود الكوبون أولًا.");
      return;
    }
    if (!phone.trim()) {
      setMessage("اكتبي رقم الهاتف أولًا لتأكيد أهلية الكوبون.");
      return;
    }
    if (total <= 0) {
      setMessage("أضيفي منتجات للسلة أولًا.");
      return;
    }

    setCouponLoading(true);
    setMessage("");
    setCouponPreview(null);
    try {
      const { data, error } = await supabase.rpc("validate_store_coupon", {
        p_code: couponCode.trim(),
        p_phone: phone.trim(),
        p_subtotal: total,
      });
      if (error) throw error;
      const result = data as CouponPreview;
      if (!result?.valid) {
        throw new Error(result?.message || "الكوبون غير صالح.");
      }
      setCouponPreview(result);
      setMessage("تم تطبيق الكوبون بنجاح ❤️");
    } catch (error) {
      setCouponPreview(null);
      setMessage(error instanceof Error ? error.message : "تعذر التحقق من الكوبون.");
    } finally {
      setCouponLoading(false);
    }
  }

  function changeQuantity(product: Product, amount: number) {
    setCouponPreview(null);
    setCart((old) => {
      const current = old[product.id] || 0;
      const next = Math.max(0, Math.min(product.stock, current + amount));

      return { ...old, [product.id]: next };
    });

    if (amount > 0 && (cart[product.id] || 0) < product.stock) {
      setCartNotice(`تمت إضافة ${product.name} إلى السلة ❤️`);
      window.setTimeout(() => setCartNotice(""), 2400);
    }
  }

  async function createOrder() {
    if (!customerName.trim() || !phone.trim() || !address.trim()) {
      setMessage("من فضلك كمّلي بيانات الاسم ورقم الهاتف والعنوان.");
      return;
    }

    if (shippingGovernorates.length === 0) {
      setMessage("لا توجد محافظات شحن متاحة حاليًا. تواصلي مع إدارة المتجر.");
      return;
    }

    if (!shippingGovernorate) {
      setMessage("اختاري محافظة الشحن أولًا.");
      return;
    }

    if (!paymentMethod) {
      setMessage("اختاري وسيلة الدفع أولًا.");
      return;
    }

    const items = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({
        productId: Number(productId),
        quantity,
      }));

    if (items.length === 0) {
      setMessage("السلة فارغة.");
      return;
    }

    if (couponCode.trim() && !couponPreview?.valid) {
      setMessage("اضغطي على تطبيق الكوبون للتحقق منه قبل تأكيد الطلب.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase.rpc("create_store_order", {
        p_customer_name: customerName.trim(),
        p_phone: phone.trim(),
        p_address: address.trim(),
        p_payment_method: paymentMethod,
        p_items: items,
        p_shipping_governorate: shippingGovernorate,
        p_coupon_code: couponPreview?.valid ? couponPreview.code : null,
      });

      if (error) throw error;

      const created = data as CreatedOrder;

      if (!created?.order_id || !created?.access_token) {
        throw new Error("لم نستلم بيانات الطلب بشكل صحيح.");
      }

      setOrder(created);
setSavedOrder(created);

const existingOrders = JSON.parse(
  localStorage.getItem("tota_saved_orders") || "[]"
);

const updatedOrders = Array.isArray(existingOrders)
  ? existingOrders.filter(
      (item: CreatedOrder) => item.order_id !== created.order_id
    )
  : [];

updatedOrders.push(created);

localStorage.setItem(
  "tota_saved_orders",
  JSON.stringify(updatedOrders)
);

      setProducts((old) =>
        old.map((product) => {
          const ordered = items.find((item) => item.productId === product.id);
          return ordered
            ? { ...product, stock: product.stock - ordered.quantity }
            : product;
        })
      );

      setCart({});
      setCouponPreview(null);
      setCouponCode("");
      setMessage("تم تسجيل طلبك بنجاح ❤️");
    } catch (error) {
      console.error("خطأ إنشاء الطلب:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "حصل خطأ أثناء تسجيل الطلب. حاولي مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadReceipt() {
    if (!order || !receipt) {
      setMessage("اختاري صورة إيصال التحويل أولًا.");
      return;
    }

    if (!receipt.type.startsWith("image/")) {
      setMessage("من فضلك اختاري صورة للإيصال.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(receipt.type)) {
      setMessage("الصيغ المسموحة هي JPG وPNG وWEBP فقط.");
      return;
    }

    if (receipt.size > 5 * 1024 * 1024) {
      setMessage("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const extension =
        receipt.type === "image/jpeg"
          ? "jpg"
          : receipt.type === "image/png"
          ? "png"
          : "webp";

      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

      const objectName =
        `${toEnglishDigits(order.order_id)}/${order.access_token}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(objectName, receipt, {
          contentType: receipt.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: submitError } = await supabase.rpc(
        "submit_payment_receipt",
        {
          p_order_id: order.order_id,
          p_access_token: order.access_token,
          p_object_name: objectName,
        }
      );

      if (submitError) throw submitError;

      setOrderCompleted(true);
      setReceipt(null);
      setMessage("تم إرسال إيصال التحويل بنجاح. طلبك الآن بانتظار المراجعة ❤️");
    } catch (error) {
      console.error("خطأ رفع الإيصال:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "تعذر إرسال الإيصال. حاولي مرة أخرى."
      );
    } finally {
      setLoading(false);
    }
  }

 function closeCheckout() {
    setCheckoutOpen(false);
    setOrder(null);
    setReceipt(null);
    setOrderCompleted(false);
    setMessage("");
    setCustomerName("");
    setPhone("");
    setAddress("");
    setPaymentMethod("");
    setShippingGovernorate("");
    setCouponCode("");
    setCouponPreview(null);
  }
  return (
    <main>
      {storeSettings.top_bar?.enabled !== false && (
        <div className="topline" style={{ background: storeSettings.top_bar?.background || undefined, color: storeSettings.top_bar?.text_color || undefined }}>
          {storeSettings.top_bar?.text || "✨ عروض واختيارات جديدة كل أسبوع — أهلًا بيك في TOTA STORE"}
        </div>
      )}

      <header className="header wrap">
        <button className="icon-btn mobile-only" type="button" aria-label="القائمة" onClick={() => document.querySelector(".nav")?.classList.toggle("mobile-open")}>
          <Menu />
        </button>

        <a className="brand" href="#">
          <img
            src="/tota-logo.png"
            alt="TOTA STORE"
            style={{ width: "45px", height: "45px", objectFit: "contain" }}
          />
          <span>
            TOTA <b>STORE</b>
            <small>SHOP • ENJOY • REPEAT</small>
          </span>
        </a>
<nav className="nav">
  <a href="#home">الرئيسية</a>

  <a href="#categories">الأقسام</a>

  <a
    href="#products"
    onClick={() => {
      setFavoritesOnly(false);
      setCategory("الكل");
      setSelectedSubcategory("");
      document.querySelector(".nav")?.classList.remove("mobile-open");
    }}
  >
    المنتجات
  </a>

  <a href="#about">عن توتا</a>

  <a href="/track-order">متابعة طلبي</a>

  <a
    href="#products"
    onClick={() => {
      setFavoritesOnly(true);
      setCategory("الكل");
      setSelectedSubcategory("");
      document.querySelector(".nav")?.classList.remove("mobile-open");
      setTimeout(() => {
        document.getElementById("products")?.scrollIntoView({
          behavior: "smooth",
        });
      }, 100);
    }}
    style={{ color: "#d94b91", fontWeight: 900 }}
  >
    ❤️ المفضلة ({toEnglishDigits(favoriteIds.length)})
  </a>
</nav>
        <div className="header-actions">
          <label className="search">
            <Search size={17} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بتدور على إيه؟"
            />
          </label>

          <button
            className="icon-btn"
            type="button"
            aria-label={favoritesOnly ? "عرض كل المنتجات" : "عرض المفضلة"}
            aria-pressed={favoritesOnly}
            onClick={() => {
              setFavoritesOnly((current) => !current);
              setCategory("الكل");
              setSelectedSubcategory("");
              document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{ position: "relative", color: favoritesOnly ? "#d94b91" : undefined }}
          >
            <Heart fill={favoritesOnly ? "currentColor" : "none"} />
            {favoriteIds.length > 0 && <span style={{ position: "absolute", top: -5, left: -5, minWidth: 18, height: 18, padding: "0 4px", borderRadius: 20, background: "#d94b91", color: "#fff", fontSize: 11, display: "grid", placeItems: "center" }}>{toEnglishDigits(favoriteIds.length)}</span>}
          </button>

          <button
            className="cart-btn"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag size={18} />
            <span>السلة</span>
            <b>{toEnglishDigits(count)}</b>
          </button>
        </div>
      </header>
      {cartNotice && (
        <div role="status" aria-live="polite" style={{ position: "fixed", zIndex: 1200, bottom: 92, left: 20, maxWidth: "min(360px, calc(100vw - 40px))", padding: "12px 18px", borderRadius: 14, background: "#54258a", color: "#fff", boxShadow: "0 10px 30px #24133144", fontWeight: 800, animation: "totaCartNotice .25s ease-out" }}>
          {cartNotice}
        </div>
      )}
{savedOrder && (
  <section
    className="wrap"
    style={{
      background: "#f5effa",
      border: "1px solid #d8c5ed",
      borderRadius: 14,
      padding: 18,
      marginTop: 20,
      marginBottom: 20,
    }}
  >
    <h3 style={{ color: "#54258a", marginBottom: 12 }}>
      آخر طلب محفوظ ❤️
    </h3>

    <p style={{ marginBottom: 10 }}>
      رقم الطلب: <b>{toEnglishDigits(savedOrder.order_id)}</b>
    </p>

    <p style={{ marginBottom: 12 }}>
      كود المتابعة:
    </p>

    <p
      dir="ltr"
      style={{
        background: "white",
        padding: 10,
        borderRadius: 8,
        textAlign: "center",
        fontWeight: 700,
        overflowWrap: "anywhere",
      }}
    >
      {savedOrder.access_token}
    </p>

    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(savedOrder.access_token)
          .then(() => alert("تم نسخ كود المتابعة ❤️"))
          .catch(() => alert("انسخي الكود يدويًا."));
      }}
      style={{
        width: "100%",
        padding: 12,
        background: "#6d35c8",
        color: "white",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontWeight: 700,
        marginBottom: 10,
      }}
    >
      نسخ كود المتابعة
    </button>

    <a href="/track-order" style={{ color: "#54258a", fontWeight: 700 }}>
      متابعة حالة الطلب
    </a>
  </section>
)}
      <section id="home" aria-label="بانر TOTA STORE" style={{ display: storeSettings.hero_banner?.enabled === false ? "none" : undefined, position: "relative", width: "100%", minHeight: "clamp(330px, 46vw, 590px)", overflow: "hidden", background: "#21112f", margin: "0 auto 36px" }}>
        {heroImages.length > 0 ? <img src={heroImages[heroIndex] || heroImages[0]} alt={storeSettings.hero_banner?.title || "TOTA STORE"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} /> : <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 75% 30%,#9b5de5 0,transparent 34%),linear-gradient(115deg,#21112f,#54258a 60%,#a83ab8)" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(17,8,27,.82),rgba(17,8,27,.48) 48%,rgba(17,8,27,.12))" }} />
        <div style={{ position: "relative", zIndex: 1, width: "min(1180px,92%)", minHeight: "clamp(330px, 46vw, 590px)", margin: "auto", display: "flex", alignItems: "center", padding: "42px 0", boxSizing: "border-box" }}>
          <div style={{ maxWidth: 560, width: "100%", color: "#fff", textAlign: "right", overflowWrap: "anywhere" }}>
            <span className="eyebrow" style={{ color: "#f5d0fe" }}><Sparkles size={15} /> اختيارات على ذوقك</span>
            <h1 style={{ color: "#fff", fontSize: "clamp(24px,5vw,64px)", lineHeight: 1.2, margin: "16px 0", maxWidth: "100%", overflowWrap: "break-word", textWrap: "balance" }}>{storeSettings.hero_banner?.title || <>كل اللي بتحبه،<br /><em>في مكان واحد.</em></>}</h1>
            <p style={{ color: "#f3e8ff", fontSize: "clamp(15px,1.7vw,19px)", lineHeight: 1.9, marginBottom: 24 }}>{storeSettings.hero_banner?.description || "اكتشف منتجات مختارة بعناية، وتجربة تسوق سهلة وممتعة مع TOTA STORE."}</p>
            <a className="primary-btn" href={storeSettings.hero_banner?.button_link || "#products"}>{storeSettings.hero_banner?.button_text || "اكتشف المنتجات"} <ArrowLeft size={17} /></a>
          </div>
        </div>
        {heroImages.length > 1 && <>
          <button type="button" aria-label="الصورة السابقة" onClick={() => setHeroIndex((current) => (current - 1 + heroImages.length) % heroImages.length)} style={{ position: "absolute", zIndex: 2, top: "50%", right: 18, transform: "translateY(-50%)", width: 44, height: 44, border: "1px solid #ffffff88", borderRadius: "50%", background: "#160b25aa", color: "white", fontSize: 25, cursor: "pointer" }}>›</button>
          <button type="button" aria-label="الصورة التالية" onClick={() => setHeroIndex((current) => (current + 1) % heroImages.length)} style={{ position: "absolute", zIndex: 2, top: "50%", left: 18, transform: "translateY(-50%)", width: 44, height: 44, border: "1px solid #ffffff88", borderRadius: "50%", background: "#160b25aa", color: "white", fontSize: 25, cursor: "pointer" }}>‹</button>
          <div style={{ position: "absolute", zIndex: 2, bottom: 18, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8 }}>{heroImages.map((_, index) => <button key={index} type="button" aria-label={`انتقل إلى الصورة ${index + 1}`} onClick={() => setHeroIndex(index)} style={{ width: heroIndex === index ? 26 : 9, height: 9, border: 0, borderRadius: 20, background: heroIndex === index ? "#fff" : "#ffffff88", cursor: "pointer", transition: "all .2s" }} />)}</div>
        </>}
      </section>

      {storeSettings.promotions?.enabled !== false && (storeSettings.promotions?.items || []).length > 0 && (
        <section className="wrap section" aria-label="العروض والإعلانات">
          <div className="section-heading"><div><span className="eyebrow">SPECIAL OFFERS</span><h2>العروض والإعلانات</h2></div></div>
          <div className="category-row" style={{ flexWrap: "wrap" }}>
            {(storeSettings.promotions?.items || []).map((item, index) => (
              <article key={`${item.title}-${index}`} style={{ flex: "1 1 220px", padding: 20, borderRadius: 18, background: "#f5effa", border: "1px solid #e5d7f2" }}>
                <strong style={{ color: "#54258a", fontSize: 18 }}>{item.title}</strong>
                {item.description && <p style={{ marginTop: 8 }}>{item.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <section id="categories" className="wrap section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">SHOP BY CATEGORY</span>
            <h2>تسوّق حسب القسم</h2>
          </div>
          <span className="muted">اختيارات مختلفة، في مكان واحد</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 18 }}>
          <button type="button" onClick={() => { setCategory("الكل"); setSelectedSubcategory(""); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }} style={{ position: "relative", minHeight: 230, overflow: "hidden", border: category === "الكل" ? "3px solid #8b3fd1" : "1px solid #eadcf4", borderRadius: 22, padding: 0, cursor: "pointer", textAlign: "right", background: "#21112f" }}>
            <img src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=85" alt="كل الأقسام" loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <span style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(15,7,24,.88),rgba(15,7,24,.04) 75%)" }} />
            <strong style={{ position: "absolute", right: 18, bottom: 18, color: "white", fontSize: 23 }}>كل الأقسام</strong>
          </button>
          {storeCategories.map((item) => (
            <button key={item.name} type="button" onClick={() => { setCategory(item.name); setSelectedSubcategory(""); }} style={{ position: "relative", minHeight: 230, overflow: "hidden", border: category === item.name ? "3px solid #8b3fd1" : "1px solid #eadcf4", borderRadius: 22, padding: 0, cursor: "pointer", textAlign: "right", background: "#21112f", boxShadow: category === item.name ? "0 10px 28px #6d35c833" : "0 8px 24px #24133118" }}>
              {item.image && <img src={item.image} alt={item.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
              <span style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(15,7,24,.88),rgba(15,7,24,.04) 75%)" }} />
              <span style={{ position: "absolute", right: 18, bottom: 18, left: 12, color: "white", display: "grid", gap: 5 }}><strong style={{ fontSize: 23 }}>{item.name}</strong><small style={{ color: "#f1e6fa", fontSize: 13 }}>{item.subcategories.length ? `${item.subcategories.length} أقسام فرعية` : "تسوقي المنتجات"}</small></span>
            </button>
          ))}
        </div>
        {category !== "الكل" && activeCategory && activeCategory.subcategories.length > 0 && (
          <div style={{ marginTop: 26 }}>
            <div className="section-heading"><div><span className="eyebrow">SUBCATEGORIES</span><h3>أقسام {activeCategory.name}</h3></div></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
              <button type="button" onClick={() => setSelectedSubcategory("")} style={{ border: !selectedSubcategory ? "2px solid #8b3fd1" : "1px solid #eadcf4", borderRadius: 16, padding: 16, background: "#f5effa", color: "#54258a", fontWeight: 800, cursor: "pointer" }}>كل {activeCategory.name}</button>
              {activeCategory.subcategories.map((sub) => (
                <button key={sub.name} type="button" onClick={() => { setSelectedSubcategory(sub.name); document.getElementById("products")?.scrollIntoView({ behavior: "smooth" }); }} style={{ position: "relative", minHeight: 125, overflow: "hidden", border: selectedSubcategory === sub.name ? "3px solid #8b3fd1" : "1px solid #eadcf4", borderRadius: 16, padding: 0, background: "#2b1938", color: "white", cursor: "pointer" }}>
                  {(sub.image || activeCategory.image) && <img src={sub.image || activeCategory.image} alt={sub.name} loading="lazy" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                  <span style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(15,7,24,.86),rgba(15,7,24,.12))" }} />
                  <strong style={{ position: "absolute", right: 12, bottom: 12, left: 8, textAlign: "right" }}>{sub.name}</strong>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="wrap section" aria-label="الأكثر مبيعاً" style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <span className="eyebrow" style={{ color: "#a34b83", letterSpacing: 2 }}>TOTA FAVORITES</span>
            <h2 style={{ margin: "6px 0 0", color: "#49204f", fontSize: "clamp(25px,3vw,34px)", fontWeight: 900 }}>الأكثر مبيعًا</h2>
            <p style={{ margin: "7px 0 0", color: "#8b7188" }}>المنتجات اللي تستحق تكون في اختياراتك</p>
          </div>
          <a href="#products" onClick={() => { setCategory("الكل"); setSelectedSubcategory(""); }} style={{ color: "#773c91", fontWeight: 800, textDecoration: "none" }}>تسوقي كل المنتجات ←</a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 18 }}>
          {bestsellerPreviewProducts.map((p, index) => (
            <article key={`best-${p.id}`} style={{ position: "relative", overflow: "hidden", borderRadius: 23, border: "2px solid #f0cddd", background: "linear-gradient(160deg,#fff 0%,#fff7fb 100%)", boxShadow: "0 10px 26px rgba(112,54,100,.09)" }}>
              <div style={{ height: 205, position: "relative", background: "#fff2f8", padding: 12 }}>
                {p.images?.[0] ? <img src={p.images[0]} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 15 }} /> : <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: 46 }}>🛍️</div>}
                {p.images?.some((image) => typeof image === "string" && image.trim()) && <button type="button" aria-label={`معاينة صور ${p.name}`} title="معاينة المنتج بحجم كبير" onClick={() => setLightbox({ name: p.name, images: p.images.filter((image) => typeof image === "string" && image.trim()), index: 0 })} style={{ position: "absolute", top: 12, left: 12, zIndex: 3, width: 38, height: 38, display: "grid", placeItems: "center", border: "1px solid #ffffffbb", borderRadius: "50%", background: "#271631dd", color: "#fff", cursor: "pointer" }}><Eye size={18} /></button>}
                <span style={{ position: "absolute", top: 12, right: 12, borderRadius: 30, padding: "6px 11px", background: "#7a3c91", color: "white", fontSize: 11, fontWeight: 900 }}>TOTA PICK</span>
              </div>
              <div style={{ padding: "15px 16px 17px", textAlign: "right" }}>
                <small style={{ color: "#a16d91", fontWeight: 700 }}>{p.category}</small>
                <h3 style={{ margin: "6px 0", color: "#49204f", fontSize: 17, fontWeight: 900 }}>{p.name}</h3>
                <strong style={{ display: "block", color: "#783e91", fontSize: 20, margin: "8px 0 12px" }}>{money(p.price)}</strong>
                <button type="button" onClick={() => changeQuantity(p, 1)} disabled={p.stock <= 0} style={{ width: "100%", border: 0, borderRadius: 12, padding: "12px 10px", background: p.stock > 0 ? "linear-gradient(90deg,#a94f91,#70409b)" : "#c9bdc8", color: "white", fontWeight: 900, cursor: p.stock > 0 ? "pointer" : "not-allowed" }}>{p.stock > 0 ? "أضيفي للسلة +" : "نفدت الكمية"}</button>
              </div>
            </article>
          ))}
        </div>
        
        {bestsellerPreviewProducts.length === 0 && <p style={{ textAlign: "center", color: "#8b7188", padding: 25 }}>لسه مفيش مبيعات مؤكدة للمنتجات.</p>}
      </section>

      <section className="wrap section" aria-label="وصل حديثاً" style={{ marginTop: 10, padding: "28px 22px", borderRadius: 28, background: "linear-gradient(120deg,#fff0f6,#f7effb)", border: "1px solid #f0d9e7" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <span className="eyebrow" style={{ color: "#a34b83", letterSpacing: 2 }}>JUST LANDED</span>
            <h2 style={{ margin: "6px 0 0", color: "#49204f", fontSize: "clamp(25px,3vw,34px)", fontWeight: 900 }}>وصل حديثًا</h2>
            <p style={{ margin: "7px 0 0", color: "#8b7188" }}>اكتشفي أحدث الإضافات للمتجر</p>
          </div>
          <span style={{ color: "#773c91", fontWeight: 800 }}>{toEnglishDigits(newArrivalProducts.length)} منتجات جديدة</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 18 }}>
          {newArrivalProducts.map((p) => (
            <article key={`new-${p.id}`} style={{ overflow: "hidden", borderRadius: 22, border: "2px solid #edcddd", background: "#fff", boxShadow: "0 8px 22px rgba(112,54,100,.07)" }}>
              <div style={{ height: 190, padding: 12, background: "#fff8fb", position: "relative" }}>
                {p.images?.[0] ? <img src={p.images[0]} alt={p.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div style={{ height: "100%", display: "grid", placeItems: "center", fontSize: 42 }}>🛍️</div>}
                {p.images?.some((image) => typeof image === "string" && image.trim()) && <button type="button" aria-label={`معاينة صور ${p.name}`} title="معاينة المنتج بحجم كبير" onClick={() => setLightbox({ name: p.name, images: p.images.filter((image) => typeof image === "string" && image.trim()), index: 0 })} style={{ position: "absolute", top: 12, left: 12, zIndex: 3, width: 38, height: 38, display: "grid", placeItems: "center", border: "1px solid #ffffffbb", borderRadius: "50%", background: "#271631dd", color: "#fff", cursor: "pointer" }}><Eye size={18} /></button>}
                <span style={{ position: "absolute", top: 12, right: 12, background: "#e78eb5", color: "#fff", borderRadius: 30, padding: "5px 10px", fontSize: 11, fontWeight: 900 }}>NEW</span>
              </div>
              <div style={{ padding: 15, textAlign: "right" }}><h3 style={{ color: "#49204f", fontSize: 17, fontWeight: 900, margin: "0 0 8px" }}>{p.name}</h3><strong style={{ color: "#783e91", fontSize: 19 }}>{money(p.price)}</strong><button type="button" onClick={() => changeQuantity(p, 1)} disabled={p.stock <= 0} style={{ display: "block", width: "100%", marginTop: 12, border: 0, borderRadius: 12, padding: 11, background: "#75418f", color: "white", fontWeight: 800, cursor: p.stock > 0 ? "pointer" : "not-allowed" }}>{p.stock > 0 ? "أضيفي للسلة" : "نفدت الكمية"}</button></div>
            </article>
          ))}
        </div>
      </section>

      <section id="products" className="wrap section products-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">{favoritesOnly ? "YOUR WISHLIST" : "THE LATEST PICKS"}</span>
            <h2>{favoritesOnly ? "منتجاتك المفضلة ❤️" : (selectedSubcategory || (category === "الكل" ? "اختياراتنا ليكي" : category))}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {favoritesOnly && <button type="button" onClick={() => setFavoritesOnly(false)} style={{ border: "1px solid #e6c8dc", borderRadius: 20, padding: "7px 12px", background: "#fff5fa", color: "#8a3f79", cursor: "pointer", fontWeight: 800 }}>كل المنتجات</button>}
            <span className="muted">{toEnglishDigits(visibleProducts.length)} منتجات</span>
          </div>
        </div>

        <div className="product-grid">
          {visibleProducts.map((p) => {
            const productImages = Array.isArray(p.images)
              ? p.images.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
              : [];
            const imageIndex = Math.min(productImageIndexes[p.id] || 0, Math.max(productImages.length - 1, 0));
            const showProductImage = (nextIndex: number) => {
              setProductImageIndexes((current) => ({ ...current, [p.id]: nextIndex }));
            };

            return (
            <article className="product-card" key={p.id} style={{
              border: "3px solid #d8c3eb", borderRadius: 24, overflow: "hidden",
              background: "#fff", boxShadow: "0 12px 30px rgba(54,25,75,.12)",
            }}>
              <div
                className="product-art"
                style={{
                  position: "relative", overflow: "hidden",
                  background: "linear-gradient(145deg,#fbf7ff,#eee2f7)",
                  cursor: productImages.length ? "zoom-in" : "default",
                }}
              >
                {productImages.length > 0 ? (
                  <img
                    src={productImages[imageIndex]}
                    alt={`${p.name} - صورة ${imageIndex + 1}`}
                    onClick={() => setLightbox({ name: p.name, images: productImages, index: imageIndex })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setLightbox({ name: p.name, images: productImages, index: imageIndex });
                      }
                    }}
                    title="اضغط لتكبير الصورة"
                    style={{
                      width: "100%", height: "100%", objectFit: "contain",
                      transition: "opacity .2s ease, transform .25s ease", cursor: "zoom-in",
                    }}
                  />
                ) : (
                  <span className="product-emoji">🛍️</span>
                )}

                {productImages.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="الصورة السابقة للمنتج"
                      onClick={() => showProductImage((imageIndex - 1 + productImages.length) % productImages.length)}
                      style={{ position: "absolute", top: "50%", right: 8, transform: "translateY(-50%)", width: 32, height: 32, border: "1px solid #ffffffaa", borderRadius: "50%", background: "#271631cc", color: "white", fontSize: 22, lineHeight: 1, cursor: "pointer", zIndex: 2 }}
                    >‹</button>
                    <button
                      type="button"
                      aria-label="الصورة التالية للمنتج"
                      onClick={() => showProductImage((imageIndex + 1) % productImages.length)}
                      style={{ position: "absolute", top: "50%", left: 8, transform: "translateY(-50%)", width: 32, height: 32, border: "1px solid #ffffffaa", borderRadius: "50%", background: "#271631cc", color: "white", fontSize: 22, lineHeight: 1, cursor: "pointer", zIndex: 2 }}
                    >›</button>
                    <span style={{ position: "absolute", top: 8, right: 8, background: "#271631dd", color: "white", padding: "4px 9px", borderRadius: 20, fontSize: 11, zIndex: 2 }}>
                      {imageIndex + 1} / {productImages.length}
                    </span>
                    <div style={{ position: "absolute", bottom: 9, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6, zIndex: 2 }}>
                      {productImages.map((_, index) => (
                        <button
                          key={index}
                          type="button"
                          aria-label={`عرض الصورة ${index + 1}`}
                          onClick={() => showProductImage(index)}
                          style={{ width: imageIndex === index ? 19 : 7, height: 7, padding: 0, border: 0, borderRadius: 20, background: imageIndex === index ? "#fff" : "#ffffff99", cursor: "pointer", transition: "all .2s" }}
                        />
                      ))}
                    </div>
                  </>
                )}

                {productImages.length > 0 && (
                  <button
                    type="button"
                    aria-label={`معاينة صور ${p.name}`}
                    title="معاينة المنتج بحجم كبير"
                    onClick={() => setLightbox({ name: p.name, images: productImages, index: imageIndex })}
                    style={{ position: "absolute", top: 12, left: 12, zIndex: 3, width: 38, height: 38, display: "grid", placeItems: "center", border: "1px solid #ffffffbb", borderRadius: "50%", background: "#271631dd", color: "#fff", cursor: "pointer", boxShadow: "0 3px 12px #0003" }}
                  >
                    <Eye size={18} />
                  </button>
                )}

                <button
                  className="favorite"
                  type="button"
                  aria-label={favoriteIds.includes(p.id) ? "إزالة من المفضلة" : "أضف للمفضلة"}
                  aria-pressed={favoriteIds.includes(p.id)}
                  onClick={() => toggleFavorite(p.id)}
                  style={{ color: favoriteIds.includes(p.id) ? "#d94b91" : undefined }}
                >
                  <Heart size={17} fill={favoriteIds.includes(p.id) ? "currentColor" : "none"} />
                </button>
              </div>

              <div className="product-info" style={{ padding: "20px 18px 22px" }}>
                <span className="product-category" style={{ fontSize: 14 }}>
                  {p.category} • {p.subcategory}
                </span>
                <h3 style={{ fontSize: "clamp(19px, 2vw, 23px)", fontWeight: 900, lineHeight: 1.5 }}>{p.name}</h3>
                <div className="price-line">
                  <strong style={{ fontSize: "clamp(21px, 2.2vw, 26px)", fontWeight: 900 }}>{money(p.price)}</strong>
                </div>

                <p className="muted small" style={{ fontSize: 15, fontWeight: 700 }}>
                  {p.stock > 0 ? `المتاح: ${new Intl.NumberFormat("en-US").format(p.stock)}` : "نفدت الكمية"}
                </p>

                <button
                  className="add-btn"
                  style={{ minHeight: 48, fontSize: 16, fontWeight: 800, borderRadius: 13 }}
                  disabled={p.stock <= 0}
                  onClick={() => changeQuantity(p, 1)}
                >
                  <Plus size={16} />
                  {p.stock > 0 ? "أضف للسلة" : "غير متاح"}
                </button>
              </div>
            </article>
            );
          })}
        </div>

        {visibleProducts.length === 0 && (
          <p className="empty">
            {favoritesOnly ? "لسه مفيش منتجات في المفضلة. اضغطي على علامة القلب في أي منتج عشان تحفظيه هنا ❤️" : "مفيش منتجات مضافة حاليًا. تابعي المتجر قريبًا ❤️"}
          </p>
        )}
      </section>

      {storeSettings.about?.enabled !== false && (
        <section id="about" className="wrap about">
          <div>
            <span className="eyebrow">A LITTLE ABOUT US</span>
            <h2>{storeSettings.about?.title || "تجربة تسوق على مزاجك."}</h2>
          </div>
          <p>{storeSettings.about?.description || "TOTA STORE مساحة واحدة لاكتشاف منتجات متنوعة. اختيارات مختلفة، وتجربة تسوق سهلة."}</p>
        </section>
      )}

      <footer className="footer">
        <div className="wrap footer-inner">
          <a className="brand footer-brand" href="#">
            <img
              src="/tota-logo.png"
              alt="TOTA STORE"
              className="brand-mark"
            />
            <span>
              TOTA <b>STORE</b>
              <small>SHOP • ENJOY • REPEAT</small>
            </span>
          </a>
          <span>{storeSettings.footer?.enabled === false ? "" : (storeSettings.footer?.description || "شكراً لثقتكم في TOTA STORE ❤️")}</span>
          {(getWhatsAppUrl(storeSettings.footer?.whatsapp_number) || getInstagramUrl(storeSettings.footer?.instagram_url) || getTikTokUrl(storeSettings.footer?.tiktok_url)) && (
            <div aria-label="حسابات التواصل الاجتماعي" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 14 }}>
              {getWhatsAppUrl(storeSettings.footer?.whatsapp_number) && (
                <a href={getWhatsAppUrl(storeSettings.footer?.whatsapp_number)} target="_blank" rel="noopener noreferrer" aria-label="تواصل مع TOTA STORE عبر واتساب" title="WhatsApp" style={{ width: 44, height: 44, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#25D366", color: "#fff", textDecoration: "none" }}>
                  <svg viewBox="0 0 32 32" width="25" height="25" fill="currentColor" aria-hidden="true"><path d="M16.02 3.2A12.7 12.7 0 0 0 5.1 22.37L3.4 28.6l6.4-1.68A12.7 12.7 0 1 0 16.02 3.2Zm0 23.1c-1.95 0-3.86-.52-5.53-1.5l-.4-.24-3.8 1 1.02-3.7-.26-.4a10.3 10.3 0 1 1 8.97 4.84Zm5.66-7.72c-.31-.16-1.85-.91-2.14-1.01-.29-.11-.5-.16-.71.16-.21.31-.82 1.01-1 1.22-.18.21-.37.23-.68.08-.31-.16-1.31-.48-2.5-1.53-.92-.82-1.54-1.84-1.72-2.15-.18-.31-.02-.48.14-.64.14-.14.31-.37.47-.55.16-.18.21-.31.31-.52.1-.21.05-.39-.03-.55-.08-.16-.71-1.7-.97-2.33-.25-.6-.51-.52-.71-.53h-.6c-.21 0-.55.08-.84.39-.29.31-1.1 1.07-1.1 2.61s1.13 3.03 1.29 3.24c.16.21 2.22 3.39 5.37 4.75.75.32 1.33.51 1.79.65.75.24 1.43.21 1.97.13.6-.09 1.85-.76 2.11-1.49.26-.73.26-1.36.18-1.49-.08-.13-.29-.21-.6-.37Z"/></svg>
                </a>
              )}
              {getInstagramUrl(storeSettings.footer?.instagram_url) && (
                <a href={getInstagramUrl(storeSettings.footer?.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="تابع TOTA STORE على إنستجرام" title="Instagram" style={{ width: 44, height: 44, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)", color: "#fff", textDecoration: "none" }}>
                  <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="18" cy="6" r="1" fill="currentColor" stroke="none"/></svg>
                </a>
              )}
              {getTikTokUrl(storeSettings.footer?.tiktok_url) && (
                <a href={getTikTokUrl(storeSettings.footer?.tiktok_url)} target="_blank" rel="noopener noreferrer" aria-label="تابع TOTA STORE على تيك توك" title="TikTok" style={{ width: 44, height: 44, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#111", color: "#fff", textDecoration: "none", border: "1px solid #444" }}>
                  <svg viewBox="0 0 24 24" width="25" height="25" fill="currentColor" aria-hidden="true"><path d="M19.6 7.2a5.7 5.7 0 0 1-3.5-1.2v8.1a5.6 5.6 0 1 1-5.6-5.6c.4 0 .8 0 1.2.1v3a2.7 2.7 0 1 0 1.5 2.5V2.5h3a5.7 5.7 0 0 0 3.4 3.4v1.3Z"/></svg>
                </a>
              )}
            </div>
          )}
          <span>© 2026 TOTA STORE</span>
        </div>
      </footer>

      <button
        type="button"
        aria-label={`فتح سلة المشتريات، ${toEnglishDigits(count)} منتجات`}
        onClick={() => setCartOpen(true)}
        style={{ position: "fixed", zIndex: 1100, bottom: 20, left: 20, minHeight: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", border: "2px solid #fff", borderRadius: 999, background: "linear-gradient(110deg,#a94f91,#70409b)", color: "#fff", boxShadow: "0 8px 26px #54258a55", cursor: "pointer", fontWeight: 900, animation: count > 0 ? "totaCartPulse 1.8s infinite" : "none" }}
      >
        <ShoppingBag size={20} />
        <span>السلة</span>
        <b style={{ minWidth: 25, height: 25, display: "grid", placeItems: "center", padding: "0 5px", borderRadius: 99, background: "#fff", color: "#70409b", fontSize: 13 }}>{toEnglishDigits(count)}</b>
      </button>

      <style jsx>{`
        @keyframes totaCartPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 8px 26px #54258a55; }
          50% { transform: scale(1.045); box-shadow: 0 10px 32px #a94f9180; }
        }
        @keyframes totaCartNotice {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {cartOpen && (
        <div className="overlay" onClick={() => setCartOpen(false)}>
          <aside
            className="cart-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cart-head">
              <h2>سلة مشترياتك</h2>
              <button
                className="icon-btn"
                onClick={() => setCartOpen(false)}
                aria-label="إغلاق"
              >
                <X />
              </button>
            </div>

            {count === 0 ? (
              <p className="empty">
                لسه السلة فاضية. اختاري منتجات تعجبك ❤️
              </p>
            ) : (
              <>
                {products
                  .filter((p) => cart[p.id])
                  .map((p) => (
                    <div className="cart-item" key={p.id}>
                      <span className="mini-art">
                        {p.images?.[0] ? (
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                              borderRadius: 8,
                            }}
                          />
                        ) : (
                          "🛍️"
                        )}
                      </span>

                      <div className="cart-item-info">
                        <b>{p.name}</b>
                        <span>{money(p.price)}</span>
                        <div className="quantity">
                          <button onClick={() => changeQuantity(p, -1)}>
                            <Minus size={14} />
                          </button>
                          <span>{cart[p.id]}</span>
                          <button
                            disabled={cart[p.id] >= p.stock}
                            onClick={() => changeQuantity(p, 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                <div className="cart-total">
                  <span>الإجمالي</span>
                  <b>{money(total)}</b>
                </div>

                <button
                  className="primary-btn"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    border: 0,
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setCartOpen(false);
                    setCheckoutOpen(true);
                    setMessage("");
                  }}
                >
                  متابعة وإتمام الطلب <ArrowLeft size={17} />
                </button>
              </>
            )}
          </aside>
        </div>
      )}

      {checkoutOpen && (
        <div className="overlay" onClick={() => !loading && closeCheckout()}>
          <aside
            className="cart-panel"
            style={{ width: "min(520px, 95vw)", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cart-head">
              <h2>
                {orderCompleted ? "تم إرسال الإيصال" : order ? "الدفع" : "إتمام الطلب"}
              </h2>
              <button
                className="icon-btn"
                onClick={closeCheckout}
                disabled={loading}
                aria-label="إغلاق"
              >
                <X />
              </button>
            </div>

            {message && (
              <p
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: "#f5effa",
                  color: "#54258a",
                  marginBottom: 15,
                  lineHeight: 1.8,
                }}
              >
                {message}
              </p>
            )}

            {orderCompleted ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <CheckCircle
                  size={55}
                  color="#29965a"
                  style={{ margin: "0 auto 15px" }}
                />
                <h3>شكرًا لطلبك من TOTA STORE ❤️</h3>
                <p style={{ marginTop: 12, lineHeight: 2 }}>
                  رقم طلبك: <b>{order ? toEnglishDigits(order.order_id) : ""}</b>
                  <br />
                  تم استلام إيصال التحويل، وطلبك في انتظار مراجعة الإدارة.
                </p>
                <button
                  className="primary-btn"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    marginTop: 20,
                    border: 0,
                    cursor: "pointer",
                  }}
                  onClick={closeCheckout}
                >
                  العودة للمتجر
                </button>
              </div>
           
) : order ? (
  <div>
    <p style={{ lineHeight: 1.9, marginBottom: 15 }}>
      رقم الطلب: <b>{toEnglishDigits(order.order_id)}</b>
      <br />
      حوّلي المبلغ باستخدام بيانات وسيلة الدفع التالية:
    </p>

    <div
      style={{
        background: "#f5effa",
        border: "1px solid #d8c5ed",
        borderRadius: 12,
        padding: 15,
        marginBottom: 18,
        lineHeight: 2,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <span>رسوم الشحن</span>
        <b>{money(Number(order.shipping_fee ?? 0))}</b>
      </div>
      {Number(order.coupon_discount || 0) > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#21834b", marginTop: 6 }}>
          <span>خصم الكوبون ({order.coupon_code})</span>
          <b>- {money(Number(order.coupon_discount || 0))}</b>
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          borderTop: "1px solid #d8c5ed",
          marginTop: 8,
          paddingTop: 8,
          color: "#54258a",
          fontSize: 18,
        }}
      >
        <strong>المبلغ المطلوب تحويله</strong>
        <strong>{money(Number(order.total ?? 0))}</strong>
      </div>
    </div>

    <div
      style={{
        background: "#f5effa",
        border: "1px solid #d8c5ed",
        borderRadius: 12,
        padding: 15,
        marginBottom: 18,
        lineHeight: 2,
      }}
    >
     <b style={{ color: "#54258a" }}>كود متابعة طلبك</b>
<p
  dir="ltr"
  style={{
    background: "white",
    padding: 10,
    borderRadius: 8,
    textAlign: "center",
    fontWeight: 700,
    overflowWrap: "anywhere",
    userSelect: "all",
  }}
>
  {order.access_token}
</p>

<button
  type="button"
  onClick={() => {
    navigator.clipboard.writeText(order.access_token)
      .then(() => alert("تم نسخ كود المتابعة بنجاح ❤️"))
      .catch(() => alert("تعذر النسخ، حددي الكود وانسخيه يدويًا."));
  }}
  style={{
    width: "100%",
    padding: 12,
    background: "#6d35c8",
    color: "white",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    marginBottom: 12,
  }}
>
  نسخ كود المتابعة
</button>

<small>احتفظي بالكود مع رقم الطلب لمتابعته لاحقًا.</small>
    </div>

    {paymentMethods
      .filter((method) => method.id === paymentMethod)
      .map((method) => (
        <div
          key={method.id}
          style={{
            background: "#f8f5fc",
            padding: 15,
            borderRadius: 12,
            marginBottom: 18,
            lineHeight: 2,
          }}
        >
          <b>{method.label}</b>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {method.account_details}
          </p>
        </div>
      ))}

    <label style={{ display: "block", marginBottom: 10 }}>
      صورة إيصال التحويل
    </label>

    <label
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        border: "2px dashed #b9a2d1",
        borderRadius: 12,
        padding: 22,
        cursor: "pointer",
        marginBottom: 15,
      }}
    >
      <Upload size={22} />
      {receipt ? receipt.name : "اختاري صورة الإيصال"}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) =>
          setReceipt(e.target.files?.[0] || null)
        }
      />
    </label>


                <p className="muted small" style={{ marginBottom: 15 }}>
                  الصيغ المسموحة JPG وPNG وWEBP، بحد أقصى 5 ميجابايت.
                </p>

                <button
                  className="primary-btn"
                  disabled={loading || !receipt}
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    border: 0,
                    cursor: loading || !receipt ? "not-allowed" : "pointer",
                    opacity: loading || !receipt ? 0.6 : 1,
                  }}
                  onClick={uploadReceipt}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} /> جاري الإرسال...
                    </>
                  ) : (
                    <>
                      إرسال إيصال التحويل <ArrowLeft size={17} />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 15 }}>
                  <label>الاسم بالكامل</label>
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="اكتبي اسمك"
                    style={fieldStyle}
                  />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label>رقم الهاتف</label>
                  <input
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setCouponPreview(null);
                    }}
                    placeholder="01xxxxxxxxx"
                    inputMode="tel"
                    style={fieldStyle}
                  />
                </div>

                <div style={{ marginBottom: 15, padding: 15, borderRadius: 12, background: "#fff8fc", border: "1px solid #e8c9dd" }}>
                  <label htmlFor="store-coupon-code" style={{ display: "block", marginBottom: 8, fontWeight: 800, color: "#54258a" }}>كود الخصم</label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input
                      id="store-coupon-code"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponPreview(null);
                      }}
                      placeholder="اكتبي كود الكوبون"
                      autoComplete="off"
                      style={{ ...fieldStyle, flex: "1 1 170px", minWidth: 0, margin: 0, direction: "ltr", textAlign: "left" }}
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={couponLoading || loading || !couponCode.trim()}
                      style={{ border: 0, borderRadius: 10, padding: "11px 18px", background: "#6d35c8", color: "#fff", fontWeight: 800, cursor: couponLoading || loading ? "not-allowed" : "pointer", opacity: couponLoading || loading ? 0.65 : 1 }}
                    >
                      {couponLoading ? "جاري التحقق..." : "تطبيق الكوبون"}
                    </button>
                  </div>
                  {couponPreview?.valid && (
                    <p style={{ margin: "10px 0 0", color: "#21834b", fontWeight: 800, lineHeight: 1.7 }}>
                      تم تطبيق {couponPreview.code} — خصم {money(Number(couponPreview.discount_amount || 0))}
                    </p>
                  )}
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label>العنوان بالتفصيل</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="المحافظة والمنطقة والشارع ورقم العقار..."
                    rows={3}
                    style={{ ...fieldStyle, resize: "vertical" }}
                  />
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label>محافظة الشحن</label>
                  {shippingGovernorates.length === 0 ? (
                    <p className="muted" style={{ marginTop: 8 }}>
                      لا توجد محافظات شحن مفعّلة حاليًا.
                    </p>
                  ) : (
                    <select
                      value={shippingGovernorate}
                      onChange={(e) => setShippingGovernorate(e.target.value)}
                      style={fieldStyle}
                    >
                      <option value="">اختاري محافظة الشحن</option>
                      {shippingGovernorates.map((item) => (
                        <option key={item.governorate} value={item.governorate}>
                          {item.governorate} — {money(item.shipping_fee)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div style={{ marginBottom: 15 }}>
                  <label>اختاري وسيلة الدفع</label>
                  {paymentMethods.length === 0 ? (
                    <p className="muted" style={{ marginTop: 8 }}>
                      لا توجد وسائل دفع مفعّلة حاليًا.
                    </p>
                  ) : (
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={fieldStyle}
                    >
                      <option value="">اختاري وسيلة الدفع</option>
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 20,
                    marginBottom: 18,
                    padding: 15,
                    borderRadius: 12,
                    background: "#f5effa",
                    border: "1px solid #e4d5f0",
                    lineHeight: 2,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>إجمالي المنتجات</span>
                    <b>{money(total)}</b>
                  </div>
                  {couponPreview?.valid && (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: "#21834b" }}>
                      <span>خصم الكوبون ({couponPreview.code})</span>
                      <b>- {money(couponDiscount)}</b>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>رسوم الشحن</span>
                    <b>
                      {shippingGovernorate ? money(shippingFee) : "اختاري المحافظة"}
                    </b>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      borderTop: "1px solid #d8c5ed",
                      marginTop: 8,
                      paddingTop: 8,
                      color: "#54258a",
                      fontSize: 17,
                    }}
                  >
                    <strong>الإجمالي المطلوب</strong>
                    <strong>{money(grandTotal)}</strong>
                  </div>
                </div>

                <button
                  className="primary-btn"
                  disabled={
                    loading ||
                    paymentMethods.length === 0 ||
                    shippingGovernorates.length === 0 ||
                    !shippingGovernorate
                  }
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    border: 0,
                    cursor:
                      loading ||
                      paymentMethods.length === 0 ||
                      shippingGovernorates.length === 0 ||
                      !shippingGovernorate
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      loading ||
                      paymentMethods.length === 0 ||
                      shippingGovernorates.length === 0 ||
                      !shippingGovernorate
                        ? 0.6
                        : 1,
                  }}
                  onClick={createOrder}
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} /> جاري تسجيل الطلب...
                    </>
                  ) : (
                    <>
                      تأكيد الطلب <ArrowLeft size={17} />
                    </>
                  )}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
      {lightbox && (
        <div role="dialog" aria-modal="true" aria-label={`عرض صور ${lightbox.name}`}
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(12,7,18,.94)", backdropFilter: "blur(8px)" }}>
          <button type="button" aria-label="إغلاق الصورة" onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 18, right: 20, width: 46, height: 46, border: "1px solid #ffffff66", borderRadius: "50%", background: "#ffffff18", color: "#fff", fontSize: 30, cursor: "pointer" }}>×</button>
          <div onClick={(event) => event.stopPropagation()}
            style={{ width: "min(100%,1050px)", height: "min(82vh,850px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, textAlign: "center" }}>{lightbox.name}</div>
            <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src={lightbox.images[lightbox.index]} alt={lightbox.name}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 14, boxShadow: "0 18px 60px #0008" }} />
              {lightbox.images.length > 1 && <>
                <button type="button" aria-label="الصورة السابقة"
                  onClick={() => setLightbox((current) => current ? { ...current, index: (current.index - 1 + current.images.length) % current.images.length } : null)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, border: "1px solid #ffffff88", borderRadius: "50%", background: "#351d49dd", color: "#fff", fontSize: 30, cursor: "pointer" }}>‹</button>
                <button type="button" aria-label="الصورة التالية"
                  onClick={() => setLightbox((current) => current ? { ...current, index: (current.index + 1) % current.images.length } : null)}
                  style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 48, height: 48, border: "1px solid #ffffff88", borderRadius: "50%", background: "#351d49dd", color: "#fff", fontSize: 30, cursor: "pointer" }}>›</button>
              </>}
            </div>
            <div dir="ltr" style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>{lightbox.index + 1} / {lightbox.images.length}</div>
          </div>
        </div>
      )}
    </main>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "12px",
  marginTop: 7,
  border: "1px solid #ddd3e8",
  borderRadius: 9,
  background: "#fff",
  color: "#191522",
  fontFamily: "inherit",
  fontSize: 15,
  outline: "none",
};
