"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { login, register } from "@/lib/api";
import { getRole } from "@/lib/auth";
import { Leaf } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        await register(email, password, displayName);
        setMode("login");
        setError("Account created! Please log in.");
        setLoading(false);
        return;
      }
      const res = await login(email, password);
      Cookies.set("access_token", res.data.access_token, { expires: 1 });
      Cookies.set("refresh_token", res.data.refresh_token, { expires: 7 });
      const role = getRole();
      router.push(role === "administrator" ? "/admin" : "/portal");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-green-600 text-white p-2 rounded-xl">
            <Leaf size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">EcoRoute</h1>
            <p className="text-sm text-gray-500">Smart waste. Clean city.</p>
          </div>
        </div>

        <div className="flex border border-gray-200 rounded-lg mb-6 overflow-hidden">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "login" ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            Sign In
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === "register" ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Jane Resident"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className={`text-sm rounded-lg px-3 py-2 ${error.startsWith("Account") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {loading ? "Loading…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-xs text-gray-400 space-y-1">
          <p><strong>Demo accounts:</strong></p>
          <p>Admin: admin@ecoroute.demo / Admin1234!</p>
          <p>Resident: resident@ecoroute.demo / Resident1234!</p>
        </div>
      </div>
    </div>
  );
}
