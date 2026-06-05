"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getBins, runPredictions, api } from "@/lib/api";
import { MapPin, Activity, Plus, X, Check } from "lucide-react";

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

interface NewBinForm {
  id: string;
  latitude: string;
  longitude: string;
  zone_id: string;
  capacity_liters: string;
}

const emptyForm: NewBinForm = { id: "", latitude: "", longitude: "", zone_id: "", capacity_liters: "" };

const fillColor = (pct: number | null) => {
  if (pct === null) return "bg-gray-200 text-gray-500";
  if (pct >= 70) return "bg-red-100 text-red-700";
  if (pct >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-green-100 text-green-700";
};

export default function BinsPage() {
  const router = useRouter();
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Registration form state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewBinForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadBins = async () => {
    try {
      const res = await getBins();
      setBins(res.data);
    } catch {
      router.push("/login");
    }
  };

  useEffect(() => {
    loadBins().finally(() => setLoading(false));
  }, []);

  const handlePredict = async () => {
    setPredicting(true);
    setMessage(null);
    try {
      const res = await runPredictions();
      setMessage({ text: `Predictions updated — ${res.data.bins_needing_collection} bins need collection.`, type: "info" });
      await loadBins();
    } catch {
      setMessage({ text: "Prediction run failed.", type: "error" });
    } finally {
      setPredicting(false);
    }
  };

  const handleRegisterBin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      await api.post("/api/bins/", {
        id: form.id.trim(),
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        zone_id: form.zone_id.trim(),
        capacity_liters: parseFloat(form.capacity_liters),
      });
      setMessage({ text: `Bin "${form.id}" registered successfully.`, type: "success" });
      setForm(emptyForm);
      setShowForm(false);
      await loadBins();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (Array.isArray(detail)) {
        setFormError(detail.map((d: any) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(" · "));
      } else {
        setFormError(typeof detail === "string" ? detail : "Registration failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const msgBg = {
    success: "bg-green-50 border-green-200 text-green-700",
    error: "bg-red-50 border-red-200 text-red-600",
    info: "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="administrator" />
      <main className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">
            Bin Registry
            <span className="ml-2 text-sm font-normal text-gray-400">{bins.length} bins</span>
          </h2>
          <div className="flex gap-3">
            <button
              onClick={handlePredict}
              disabled={predicting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            >
              <Activity size={14} /> {predicting ? "Predicting…" : "Update Predictions"}
            </button>
            <button
              onClick={() => { setShowForm(!showForm); setFormError(""); }}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? "Cancel" : "Register Bin"}
            </button>
          </div>
        </div>

        {/* Toast message */}
        {message && (
          <div className={`border rounded-xl px-4 py-3 text-sm ${msgBg[message.type]}`}>
            {message.text}
          </div>
        )}

        {/* Registration Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin size={16} className="text-green-600" /> Register New Bin
            </h3>
            <form onSubmit={handleRegisterBin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Bin ID *</label>
                <input
                  required
                  value={form.id}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  placeholder="BIN-021"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Zone ID *</label>
                <input
                  required
                  value={form.zone_id}
                  onChange={(e) => setForm({ ...form, zone_id: e.target.value })}
                  placeholder="north"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latitude * (−90 to 90)</label>
                <input
                  required
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                  placeholder="40.7128"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Longitude * (−180 to 180)</label>
                <input
                  required
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                  placeholder="-74.0060"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Capacity (liters) * (1 – 100,000)</label>
                <input
                  required
                  type="number"
                  min={1}
                  max={100000}
                  value={form.capacity_liters}
                  onChange={(e) => setForm({ ...form, capacity_liters: e.target.value })}
                  placeholder="240"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {formError && (
                <div className="md:col-span-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
                  {formError}
                </div>
              )}

              <div className="md:col-span-2 flex gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                >
                  <Check size={14} /> {submitting ? "Registering…" : "Register Bin"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(emptyForm); setFormError(""); }}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bins table */}
        {loading ? (
          <p className="text-gray-400 text-sm">Loading bins…</p>
        ) : bins.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            <MapPin size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No bins registered yet. Click "Register Bin" to add the first one.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Bin ID</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Zone</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Location</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Capacity (L)</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Predicted Fill</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bins.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-800">{b.id}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{b.zone_id}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                      {b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{b.capacity_liters}</td>
                    <td className="px-4 py-3">
                      {b.predicted_fill_pct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${b.predicted_fill_pct >= 70 ? "bg-red-500" : b.predicted_fill_pct >= 40 ? "bg-yellow-400" : "bg-green-500"}`}
                              style={{ width: `${b.predicted_fill_pct}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${fillColor(b.predicted_fill_pct)}`}>
                            {b.predicted_fill_pct.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">Not predicted</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {b.requires_collection ? (
                        <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-1 rounded-full">Needs Collection</span>
                      ) : (
                        <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
