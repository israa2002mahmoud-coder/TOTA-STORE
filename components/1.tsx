
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