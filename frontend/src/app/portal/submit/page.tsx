"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { submitWastePhoto, getMe } from "@/lib/api";
import { Upload, CheckCircle, XCircle, AlertTriangle, Leaf } from "lucide-react";
import { useEffect } from "react";

type ResultState = {
  result: "validated" | "rejected" | "uncertain" | "duplicate";
  category: string;
  confidence_score: number;
  tokens_awarded?: number;
  message?: string;
  submission_id?: string;
  original_submission_id?: string;
} | null;

export default function SubmitPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResultState>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMe().then((res) => setUser(res.data)).catch(() => router.push("/login"));
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError("");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError("");
  };

  const handleSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      const res = await submitWastePhoto(file);
      setResult(res.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resultConfig = {
    validated: {
      icon: <CheckCircle className="text-green-500" size={36} />,
      title: "Waste Validated!",
      bg: "bg-green-50 border-green-200",
    },
    rejected: {
      icon: <XCircle className="text-red-500" size={36} />,
      title: "Not Properly Segregated",
      bg: "bg-red-50 border-red-200",
    },
    uncertain: {
      icon: <AlertTriangle className="text-yellow-500" size={36} />,
      title: "Photo Unclear",
      bg: "bg-yellow-50 border-yellow-200",
    },
    duplicate: {
      icon: <XCircle className="text-orange-500" size={36} />,
      title: "Duplicate Image Detected",
      bg: "bg-orange-50 border-orange-200",
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="resident" displayName={user?.display_name} />
      <main className="max-w-xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Submit Waste Photo</h2>

        {/* Upload area */}
        {!result && (
          <div
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-green-400 transition-colors"
            onClick={() => fileInput.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-xl object-contain" />
            ) : (
              <div className="space-y-3">
                <Upload className="mx-auto text-gray-400" size={40} />
                <p className="text-gray-500">Drag & drop your waste photo here, or click to browse</p>
                <p className="text-xs text-gray-400">JPEG or PNG, max 10 MB</p>
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {preview && !result && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
            >
              Clear
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? "Analysing…" : <><Leaf size={16} /> Validate & Earn</>}
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Result card */}
        {result && (() => {
          const cfg = resultConfig[result.result];
          return (
            <div className={`mt-6 border rounded-2xl p-6 ${cfg.bg}`}>
              <div className="flex flex-col items-center text-center gap-3">
                {cfg.icon}
                <h3 className="text-lg font-bold text-gray-900">{cfg.title}</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <p>Category: <strong className="capitalize">{result.category}</strong></p>
                  <p>Confidence: <strong>{(result.confidence_score * 100).toFixed(0)}%</strong></p>
                  {result.tokens_awarded !== undefined && result.tokens_awarded > 0 && (
                    <p className="text-green-700 font-semibold text-base">
                      +{result.tokens_awarded} Green Tokens earned!
                    </p>
                  )}
                  {result.message && <p className="text-gray-500 text-xs">{result.message}</p>}
                </div>
                <div className="flex gap-3 mt-2 w-full">
                  <button
                    onClick={() => { setResult(null); setFile(null); setPreview(null); }}
                    className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-xl text-sm hover:bg-white"
                  >
                    Submit Another
                  </button>
                  <button
                    onClick={() => router.push("/portal")}
                    className="flex-1 bg-green-600 text-white py-2 rounded-xl text-sm hover:bg-green-700"
                  >
                    View Dashboard
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
