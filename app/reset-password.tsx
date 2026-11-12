"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function updatePassword() {
    if (password.length < 6) {
      setMessage("كلمة المرور لازم تكون 6 أحرف على الأقل.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("تم تغيير كلمة المرور بنجاح ❤️");
  }

  return (
    <main dir="rtl" style={{ padding: 30, maxWidth: 400, margin: "80px auto" }}>
      <h1>TOTA STORE</h1>
      <h2>تغيير كلمة المرور</h2>

      <input
        type="password"
        placeholder="كلمة المرور الجديدة"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 12, marginBottom: 15 }}
      />

      <button onClick={updatePassword} style={{ padding: 12, width: "100%" }}>
        حفظ كلمة المرور الجديدة
      </button>

      <p>{message}</p>
    </main>
  );
}