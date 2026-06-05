"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/Navbar";
import { getMe, getAnalytics, runPredictions, getTodayRoutes, getBins, simulateSensors } from "@/lib/api";
import { Truck, MapPin, Coins, BarChart2, Play, CheckCircle, Zap, RefreshCw } from "lucide-react";
import Cookies from "js-cookie";

// Leaflet must load client-side only
const BinMap = dynamic(() => import("@/components/BinMap"), { ssr: false });

interface Analytics {
  total_bins_monitored: number;
  routes_completed_this_month: number;
  total_green_tokens_minted: number;
  prediction_accuracy_mae: number | null;
}

interface Bin {
  id: string;
  latitude: number;
  longitude: number;
  zone_id: string;
  capacity_liters: number;
  is_active: boolean;
  requires_collection: boolean;
  predicted_fill_pct: number | null;
}

interface RouteStop {
  id: string;
  bin_id: string;
  stop_order: number;
  is_collected: boolean;
  bin_lat: number;
  bin_lon: number;
}

interface Route {
  id: string;
  vehicle_id: string;
  operational_date: string;
  total_distance_km: number;
  estimated_hours: number;
  is_completed: boolean;
  stops: RouteStop[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser]           = useState<any>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [routes, setRoutes]       = useState<Route[]>([]);
  const [bins, setBins]           = useState<Bin[]>([]);
  const [loading, setLoading]     = useState(true);

  const [predicting,  setPredicting]  = useState(false);
  const [simulating,  setSimulating]  = useState(false);
  const [banner, setBanner] = useState<{ text: string; kind: "info" | "success" | "warn" } | null>(null);

  const showBanner = (text: string, kind: "info" | "success" | "warn" = "info") => {
    setBanner({ text, kind });
    setTimeout(() => setBanner(null), 6000);
  };

  const loadData = useCallback(async () => {
    try {
      const [analyticsRes, routesRes, binsRes] = await Promise.all([
        getAnalytics(),
        getTodayRoutes(),
        getBins(),
      ]);
      setAnalytics(analyticsRes.data);
      setRoutes(routesRes.data);
      setBins(binsRes.data);
    } catch {}
  }, []);

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) { router.push("/login"); return; }

    Promise.all([getMe(), getAnalytics(), getTodayRoutes(), getBins()])
      .then(([me, ana, rts, binsRes]) => {
        if (me.data.role !== "administrator") { router.push("/portal"); return; }
        setUser(me.data);
        setAnalytics(ana.data);
        setRoutes(rts.data);
        setBins(binsRes.data);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));

    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, [router, loadData]);

  const handleRunPredictions = async () => {
    setPredicting(true);
    try {
      const res = await runPredictions();
      const d = res.data;
      showBanner(
        `Predictions updated — ${d.total_bins_predicted} bins · ${d.bins_needing_collection} need collection.`,
        "info"
      );
      await loadData();
    } catch {
      showBanner("Prediction run failed.", "warn");
    } finally {
      setPredicting(false);
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await simulateSensors();
      const d = res.data;
      const critical = d.newly_critical_bins.length;
      showBanner(
        `📡 ${d.readings_pushed} sensor readings pushed${critical > 0 ? ` · ${critical} bin${critical > 1 ? "s" : ""} just crossed 70%!` : " · all bins updated."}`,
        critical > 0 ? "warn" : "success"
      );
      // Re-run predictions so the map colours update immediately
      await runPredictions();
      await loadData();
    } catch {
      showBanner("Simulation failed.", "warn");
    } finally {
      setSimulating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-green-600 font-medium">Loading…</p>
    </div>
  );

  const bannerStyle = {
    info:    "bg-blue-50 border-blue-200 text-blue-700",
    success: "bg-green-50 border-green-200 text-green-700",
    warn:    "bg-amber-50 border-amber-200 text-amber-700",
  };

  const criticalCount = bins.filter(b => b.requires_collection).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="administrator" displayName={user?.display_name} />

      <main className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold text-gray-900">Command Center</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSimulate}
              disabled={simulating || predicting}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            >
              <Zap size={14} /> {simulating ? "Simulating…" : "Simulate Sensors"}
            </button>
            <button
              onClick={handleRunPredictions}
              disabled={predicting || simulating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            >
              <Play size={14} /> {predicting ? "Predicting…" : "Run Predictions"}
            </button>
            <button
              onClick={() => router.push("/admin/routes")}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Truck size={14} /> Manage Routes
            </button>
            <button
              onClick={loadData}
              className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl bg-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Banner */}
        {banner && (
          <div className={`border rounded-xl px-4 py-3 text-sm ${bannerStyle[banner.kind]}`}>
            {banner.text}
          </div>
        )}

        {/* Analytics cards */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <AnalyticsCard
              icon={<MapPin className="text-green-500" />}
              label="Bins Monitored"
              value={analytics.total_bins_monitored}
            />
            <AnalyticsCard
              icon={<Truck className="text-blue-500" />}
              label="Routes This Month"
              value={analytics.routes_completed_this_month}
            />
            <AnalyticsCard
              icon={<Coins className="text-yellow-500" />}
              label="Tokens Minted"
              value={analytics.total_green_tokens_minted}
            />
            <AnalyticsCard
              icon={<BarChart2 className="text-purple-500" />}
              label="Prediction MAE"
              value={analytics.prediction_accuracy_mae !== null ? `${analytics.prediction_accuracy_mae}%` : "N/A"}
            />
          </div>
        )}

        {/* Bin map */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-green-600" />
              <span className="font-semibold text-gray-900">Live Bin Map</span>
              <span className="text-xs text-gray-400">{bins.length} bins</span>
            </div>
            {criticalCount > 0 && (
              <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full animate-pulse">
                {criticalCount} need collection
              </span>
            )}
          </div>
          <div className="h-96">
            <BinMap bins={bins} />
          </div>
        </div>

        {/* Today's Routes */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">
            Today&apos;s Collection Routes
            <span className="ml-2 text-sm font-normal text-gray-400">
              {new Date().toLocaleDateString()}
            </span>
          </h3>
          {routes.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Truck size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No routes generated for today yet.</p>
              <button
                onClick={() => router.push("/admin/routes")}
                className="mt-3 text-green-600 text-sm hover:underline"
              >
                Generate routes →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {routes.map((r) => (
                <div key={r.id} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">Vehicle: {r.vehicle_id}</div>
                    <div className="text-sm text-gray-500">
                      {r.stops.length} stops · {r.total_distance_km?.toFixed(1)} km · {r.estimated_hours?.toFixed(1)} hrs
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.is_completed ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                        <CheckCircle size={14} /> Complete
                      </span>
                    ) : (
                      <span className="text-sm text-yellow-600 font-medium">
                        {r.stops.filter(s => s.is_collected).length}/{r.stops.length} collected
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

function AnalyticsCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500">{label}</div>
      </div>
    </div>
  );
}
