"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Navbar } from "@/components/Navbar";
import { generateRoutes, getTodayRoutes, markStopCollected, runPredictions } from "@/lib/api";
import { Truck, Play, CheckCircle, AlertCircle } from "lucide-react";

// Leaflet must be loaded client-side
const RouteMap = dynamic(() => import("@/components/RouteMap"), { ssr: false });

interface RouteStop {
  id: string;
  bin_id: string;
  stop_order: number;
  is_collected: boolean;
  collected_at: string | null;
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

export default function RoutesPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicleCount, setVehicleCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const res = await getTodayRoutes();
      setRoutes(res.data);
      if (res.data.length > 0 && !selectedRoute) setSelectedRoute(res.data[0]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRoutes(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setMessage("");
    try {
      // First run predictions to mark bins
      await runPredictions();

      const today = new Date().toISOString().split("T")[0];
      const vehicleIds = Array.from({ length: vehicleCount }, (_, i) => `VEH-${String(i + 1).padStart(3, "0")}`);
      const res = await generateRoutes(today, vehicleIds);
      setMessage(`Generated ${res.data.routes_created} route(s).`);
      await loadRoutes();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setMessage(typeof detail === "string" ? detail : "Route generation failed.");
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkCollected = async (stop: RouteStop) => {
    try {
      await markStopCollected(stop.id, 95); // mock actual fill at 95%
      await loadRoutes();
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="administrator" />
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Collection Routes</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Vehicles:</span>
              <input
                type="number"
                min={1}
                max={20}
                value={vehicleCount}
                onChange={(e) => setVehicleCount(parseInt(e.target.value) || 1)}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            >
              <Play size={14} /> {generating ? "Generating…" : "Generate Today's Routes"}
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Routes list */}
          <div className="space-y-3">
            {loading && <p className="text-gray-400 text-sm">Loading routes…</p>}
            {!loading && routes.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400">
                <Truck size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No routes for today. Click Generate to create them.</p>
              </div>
            )}
            {routes.map((r) => (
              <div
                key={r.id}
                onClick={() => setSelectedRoute(r)}
                className={`cursor-pointer bg-white rounded-2xl border-2 p-4 transition-colors ${selectedRoute?.id === r.id ? "border-green-500" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{r.vehicle_id}</span>
                  {r.is_completed ? (
                    <CheckCircle size={16} className="text-green-500" />
                  ) : (
                    <span className="text-xs text-yellow-600 font-medium">
                      {r.stops.filter((s) => s.is_collected).length}/{r.stops.length} done
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {r.total_distance_km?.toFixed(1)} km · {r.estimated_hours?.toFixed(1)} hrs · {r.stops.length} stops
                </div>
              </div>
            ))}
          </div>

          {/* Map + stops */}
          <div className="lg:col-span-2 space-y-4">
            {selectedRoute && (
              <>
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden h-80">
                  <RouteMap stops={selectedRoute.stops} />
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                  <h4 className="font-medium text-gray-900 mb-3">
                    {selectedRoute.vehicle_id} — Stops
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedRoute.stops.map((stop) => (
                      <div key={stop.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${stop.is_collected ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                            {stop.stop_order + 1}
                          </span>
                          <span className="text-sm text-gray-700">{stop.bin_id}</span>
                        </div>
                        {stop.is_collected ? (
                          <span className="text-xs text-green-600 flex items-center gap-1">
                            <CheckCircle size={12} /> Collected
                          </span>
                        ) : (
                          <button
                            onClick={() => handleMarkCollected(stop)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-lg transition-colors"
                          >
                            Mark Collected
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
