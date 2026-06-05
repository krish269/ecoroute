"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { getRole } from "@/lib/auth";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const role = getRole();
    if (role === "administrator") {
      router.replace("/admin");
    } else {
      router.replace("/portal");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-green-600 text-lg font-medium">Loading EcoRoute…</div>
    </div>
  );
}
