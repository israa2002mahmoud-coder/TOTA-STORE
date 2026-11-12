
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("جاري التحقق من رابط الاستعادة...");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (
        (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") &&
        session
      ) {
        setReady(true);
        setMessage("اكتبي كلمة المرور الجديدة.");
      }
    });

    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setMessage("حصل خطأ أثناء التحقق. اطلبي رابط استعادة جديدًا.");
          return;
        }

        if (data.session) {
          setReady(true);
          setMessage("اكتبي كلمة المرور الجديدة.");
        } else {
          setMessage(
            "رابط الاستعادة غير صالح أو انتهت صلاحيته. اطلبي رابطًا جديدًا."
          );
        }
      } catch {
        if (mounted) {
          setMessage("تعذر التحقق من الرابط. حاولي مرة أخرى.");
        }
      }
    }

    checkSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function updatePassword() {
    if (password.length < 6) {
      setMessage("كلمة المرور لازم تكون 6 أحرف على الأقل.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage("فشل تغيير كلمة المرور: " + error.message);
        return;
      }

      setPassword("");
      setReady(false);
      setMessage("تم تغيير كلمة المرور بنجاح ❤️");
    } catch {
      setMessage("حصل خطأ، حاولي مرة تانية.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        padding: 30,
        maxWidth: 400,
        margin: "80px auto",
        textAlign: "center",
      }}
    >
      <h1 style={{ color: "#ed70e8" }}>TOTA STORE</h1>
      <h2>تغيير كلمة المرور</h2>

      {ready && (
        <>
          <input
            type="password"
            placeholder="كلمة المرور الجديدة"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 15,
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={updatePassword}
            disabled={loading}
            style={{ padding: 12, width: "100%" }}
          >
            {loading ? "جاري الحفظ..." : "حفظ كلمة المرور الجديدة"}
          </button>
        </>
      )}

      <p>{message}</p>
    </main>
  );
}
