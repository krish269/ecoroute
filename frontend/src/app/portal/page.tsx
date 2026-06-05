"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getMe, getSubmissions, getImpact } from "@/lib/api";
import { Leaf, Coins, Weight, Wind, CheckCircle, Clock, AlertCircle, Wallet, RefreshCw } from "lucide-react";
import Cookies from "js-cookie";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
    };
  }
}

interface Submission {
  id: string;
  category: string;
  confidence_score: number;
  tokens_awarded: number;
  reward_status: string;
  tx_hash: string | null;
  created_at: string;
}

interface Impact {
  total_submissions: number;
  total_tokens_earned: number;
  total_weight_kg: number;
  co2_saved_kg: number;
}

const categoryColors: Record<string, string> = {
  plastics: "bg-blue-100 text-blue-700",
  electronics: "bg-purple-100 text-purple-700",
  organics: "bg-green-100 text-green-700",
  "non-segregated": "bg-red-100 text-red-700",
};

const statusIcon: Record<string, React.ReactNode> = {
  completed: <CheckCircle size={14} className="text-green-500" />,
  pending: <Clock size={14} className="text-yellow-500" />,
  retrying: <Clock size={14} className="text-orange-500" />,
  failed: <AlertCircle size={14} className="text-red-500" />,
  queued: <Clock size={14} className="text-blue-500" />,
};

export default function PortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [impact, setImpact] = useState<Impact | null>(null);
  const [loading, setLoading] = useState(true);

  // On-chain balance state
  const [onChainBalance, setOnChainBalance] = useState<string | null>(null);
  const [balanceStale, setBalanceStale] = useState(false);
  const [fetchingBalance, setFetchingBalance] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);

  const fetchOnChainBalance = useCallback(async (address: string) => {
    if (!window.ethereum || !address) return;
    setFetchingBalance(true);
    setBalanceStale(false);
    try {
      // ERC-20 balanceOf(address) — selector 0x70a08231
      const data = "0x70a08231" + address.replace("0x", "").padStart(64, "0");
      const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
      if (!contractAddress) {
        setOnChainBalance(null);
        return;
      }
      const result: string = await window.ethereum.request({
        method: "eth_call",
        params: [{ to: contractAddress, data }, "latest"],
      });
      const balance = parseInt(result, 16);
      setOnChainBalance(isNaN(balance) ? "0" : balance.toString());
    } catch {
      setBalanceStale(true);
    } finally {
      setFetchingBalance(false);
    }
  }, []);

  const handleConnectWallet = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts[0]) {
        setWalletConnected(true);
        await fetchOnChainBalance(accounts[0]);
      }
    } catch {
      // user rejected
    }
  }, [fetchOnChainBalance]);

  // Auto-connect if already approved
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts[0]) {
        setWalletConnected(true);
        fetchOnChainBalance(accounts[0]);
      }
    }).catch(() => {});
  }, [fetchOnChainBalance]);

  // Auto-refresh balance every 30s when wallet is connected
  useEffect(() => {
    if (!walletConnected) return;
    const interval = setInterval(async () => {
      if (!window.ethereum) return;
      const accounts: string[] = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
      if (accounts[0]) fetchOnChainBalance(accounts[0]);
    }, 30_000);
    return () => clearInterval(interval);
  }, [walletConnected, fetchOnChainBalance]);

  useEffect(() => {
    const token = Cookies.get("access_token");
    if (!token) { router.push("/login"); return; }

    Promise.all([getMe(), getSubmissions(), getImpact()])
      .then(([me, subs, imp]) => {
        setUser(me.data);
        setSubmissions(subs.data);
        setImpact(imp.data);
      })
      .catch(() => router.push("/login"))
      .finally(() => setLoading(false));

    // Auto-refresh submissions every 30s to catch reward status changes
    const interval = setInterval(async () => {
      try {
        const [subs, imp] = await Promise.all([getSubmissions(), getImpact()]);
        setSubmissions(subs.data);
        setImpact(imp.data);
      } catch {}
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-green-600 font-medium">Loading…</div>
    </div>
  );

  const hasWeb3 = typeof window !== "undefined" && !!window.ethereum;
  const contractConfigured = !!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="resident" displayName={user?.display_name} />

      <main className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-6 text-white">
          <h2 className="text-2xl font-bold mb-1">Hi, {user?.display_name} 👋</h2>
          <p className="opacity-80">Your waste sorting helps keep our city clean.</p>
        </div>

        {/* Token balance card — with Web3 live balance */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-2.5 rounded-xl">
                <Coins className="text-yellow-600" size={20} />
              </div>
              <div>
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">Green Token Balance</div>
                {onChainBalance !== null ? (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{onChainBalance} GRN</span>
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">On-chain</span>
                    {balanceStale && <span className="text-xs text-orange-500">⚠ stale</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-gray-900">{impact?.total_tokens_earned ?? 0} GRN</span>
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">From records</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {walletConnected && onChainBalance !== null && (
                <button
                  onClick={async () => {
                    const accs: string[] = await window.ethereum!.request({ method: "eth_accounts" });
                    if (accs[0]) fetchOnChainBalance(accs[0]);
                  }}
                  disabled={fetchingBalance}
                  className="p-2 text-gray-400 hover:text-green-600 transition-colors disabled:opacity-40"
                  title="Refresh balance"
                >
                  <RefreshCw size={14} className={fetchingBalance ? "animate-spin" : ""} />
                </button>
              )}
              {/* Connect Wallet button — always visible */}
              {hasWeb3 ? (
                !walletConnected ? (
                  <button
                    onClick={handleConnectWallet}
                    className="flex items-center gap-2 border-2 border-green-600 text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Wallet size={13} /> Connect Wallet
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                    <CheckCircle size={13} /> Wallet connected
                  </span>
                )
              ) : (
                <a
                  href="/portal/profile"
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-600 transition-colors"
                >
                  <Wallet size={13} /> Link wallet →
                </a>
              )}
            </div>
          </div>

          {!contractConfigured && walletConnected && (
            <p className="text-xs text-gray-400 mt-3 border-t border-gray-100 pt-3">
              Set <code className="bg-gray-100 px-1 rounded">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in <code className="bg-gray-100 px-1 rounded">.env.local</code> to read live on-chain balance.
            </p>
          )}
        </div>

        {/* Impact stats */}
        {impact && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={<CheckCircle className="text-green-500" />} label="Submissions" value={impact.total_submissions} />
            <StatCard icon={<Weight className="text-blue-500" />} label="Weight (kg)" value={impact.total_weight_kg.toFixed(1)} />
            <StatCard icon={<Wind className="text-teal-500" />} label="CO₂ Saved (kg)" value={impact.co2_saved_kg.toFixed(1)} />
          </div>
        )}

        {/* Submit CTA */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Ready to recycle?</h3>
            <p className="text-sm text-gray-500">Take a photo and earn Green Tokens instantly.</p>
          </div>
          <button
            onClick={() => router.push("/portal/submit")}
            className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Leaf size={16} /> Submit Waste
          </button>
        </div>

        {/* Submissions history */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Submission History</h3>
          {submissions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No submissions yet. Start recycling to earn tokens!</p>
          ) : (
            <div className="space-y-3">
              {submissions.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${categoryColors[s.category] ?? "bg-gray-100 text-gray-700"}`}>
                      {s.category}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-800">+{s.tokens_awarded} GRN</div>
                      <div className="text-xs text-gray-400">
                        {new Date(s.created_at).toLocaleDateString()} · {(s.confidence_score * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {statusIcon[s.reward_status]}
                      <span className="capitalize">{s.reward_status}</span>
                    </div>
                    {s.tx_hash && (
                      <a
                        href={`https://amoy.polygonscan.com/tx/${s.tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline font-mono"
                      >
                        {s.tx_hash.slice(0, 10)}…
                      </a>
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
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
