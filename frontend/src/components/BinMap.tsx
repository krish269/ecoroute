"use client";
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface Bin {
  id: string;
  latitude: number;
  longitude: number;
  zone_id: string;
  capacity_liters: number;
  predicted_fill_pct: number | null;
  requires_collection: boolean;
}

// Fill % → color
function fillToColor(pct: number | null): string {
  if (pct === null) return "#9ca3af";   // gray — no data
  if (pct >= 70)    return "#ef4444";   // red — needs collection
  if (pct >= 40)    return "#f59e0b";   // amber — getting full
  return "#22c55e";                      // green — ok
}

function fillToRadius(pct: number | null): number {
  if (pct === null) return 8;
  return 8 + (pct / 100) * 8; // 8–16 px based on fill level
}

export default function BinMap({ bins }: { bins: Bin[] }) {
  if (!bins || bins.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No bin data to display
      </div>
    );
  }

  const avgLat = bins.reduce((s, b) => s + b.latitude,  0) / bins.length;
  const avgLon = bins.reduce((s, b) => s + b.longitude, 0) / bins.length;
  const center: [number, number] = [avgLat, avgLon];

  // counts for legend
  const critical = bins.filter(b => (b.predicted_fill_pct ?? 0) >= 70).length;
  const warning  = bins.filter(b => (b.predicted_fill_pct ?? 0) >= 40 && (b.predicted_fill_pct ?? 0) < 70).length;
  const ok       = bins.filter(b => (b.predicted_fill_pct ?? 0) < 40 && b.predicted_fill_pct !== null).length;
  const unknown  = bins.filter(b => b.predicted_fill_pct === null).length;

  return (
    <div className="relative h-full w-full">
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        />
        {bins.map((b) => (
          <CircleMarker
            key={b.id}
            center={[b.latitude, b.longitude]}
            radius={fillToRadius(b.predicted_fill_pct)}
            pathOptions={{
              color: fillToColor(b.predicted_fill_pct),
              fillColor: fillToColor(b.predicted_fill_pct),
              fillOpacity: 0.85,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{b.id}</strong> — Zone: {b.zone_id}<br />
              Fill: {b.predicted_fill_pct !== null ? `${b.predicted_fill_pct.toFixed(0)}%` : "unknown"}
            </Tooltip>
            <Popup>
              <div className="text-sm space-y-1">
                <p><strong>{b.id}</strong></p>
                <p>Zone: <span className="capitalize">{b.zone_id}</span></p>
                <p>Capacity: {b.capacity_liters} L</p>
                <p>
                  Predicted fill:{" "}
                  <strong style={{ color: fillToColor(b.predicted_fill_pct) }}>
                    {b.predicted_fill_pct !== null ? `${b.predicted_fill_pct.toFixed(0)}%` : "—"}
                  </strong>
                </p>
                {b.requires_collection && (
                  <p className="text-red-600 font-semibold">⚠ Needs collection</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend overlay */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 text-xs space-y-1">
        <p className="font-semibold text-gray-700 mb-1">Fill Level</p>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          <span className="text-gray-600">≥70% needs collection ({critical})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
          <span className="text-gray-600">40–69% filling ({warning})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          <span className="text-gray-600">&lt;40% ok ({ok})</span>
        </div>
        {unknown > 0 && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />
            <span className="text-gray-600">no data ({unknown})</span>
          </div>
        )}
      </div>
    </div>
  );
}
