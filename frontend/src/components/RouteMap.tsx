"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";

// Fix default Leaflet icon paths broken by Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const collectedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const pendingIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface RouteStop {
  id: string;
  bin_id: string;
  stop_order: number;
  is_collected: boolean;
  bin_lat: number;
  bin_lon: number;
}

export default function RouteMap({ stops }: { stops: RouteStop[] }) {
  if (!stops || stops.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        No stops to display
      </div>
    );
  }

  const center: [number, number] = [
    stops.reduce((a, s) => a + s.bin_lat, 0) / stops.length,
    stops.reduce((a, s) => a + s.bin_lon, 0) / stops.length,
  ];

  const polylinePoints: [number, number][] = stops
    .sort((a, b) => a.stop_order - b.stop_order)
    .map((s) => [s.bin_lat, s.bin_lon]);

  return (
    <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
      />
      <Polyline positions={polylinePoints} color="#16a34a" weight={2} opacity={0.7} dashArray="6 4" />
      {stops.map((stop) => (
        <Marker
          key={stop.id}
          position={[stop.bin_lat, stop.bin_lon]}
          icon={stop.is_collected ? collectedIcon : pendingIcon}
        >
          <Popup>
            <strong>Stop {stop.stop_order + 1}</strong><br />
            Bin: {stop.bin_id}<br />
            Status: {stop.is_collected ? "✅ Collected" : "⏳ Pending"}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
