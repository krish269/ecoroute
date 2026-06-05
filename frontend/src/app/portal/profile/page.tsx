"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { getMe, updateWallet } from "@/lib/api";
import { Wallet, Save, Plug, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";

// Extend Window to include ethereum injected by MetaMask / browser wallets
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, handler: (...args: any[]) => void) => void;
      removeListener: (event: string, handler: (...args: any[]) => void) => void;
      isMetaMask?: boolean;
    };
  }
}

type WalletStatus = "idle" | "connecting" | "connected" | "error";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [wallet, setWallet] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Web3 wallet connect state
  const [walletStatus, setWalletStatus] = useState<WalletStatus>("idle");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState("");
  const [hasWeb3, setHasWeb3] = useState(false);

  useEffect(() => {
    getMe()
      .then((res) => {
        setUser(res.data);
        setWallet(res.data.wallet_address || "");
      })
      .catch(() => router.push("/login"));

    // Check for Web3 provider on mount
    setHasWeb3(typeof window !== "undefined" && !!window.ethereum);
  }, [router]);

  // Listen for account changes from MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const handler = (accounts: string[]) => {
      if (accounts.length === 0) {
        setConnectedAddress(null);
        setWalletStatus("idle");
      } else {
        setConnectedAddress(accounts[0]);
        setWalletStatus("connected");
        setWallet(accounts[0]);
      }
    };
    window.ethereum.on("accountsChanged", handler);
    return () => window.ethereum?.removeListener("accountsChanged", handler);
  }, []);

  const handleConnectWallet = useCallback(async () => {
    setWalletError("");
    if (!window.ethereum) {
      setWalletError("No Web3 wallet detected. Install MetaMask to use this feature.");
      return;
    }
    setWalletStatus("connecting");
    try {
      const accounts: string[] = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts.length === 0) throw new Error("No accounts returned");
      const address = accounts[0];
      setConnectedAddress(address);
      setWalletStatus("connected");
      // Auto-fill the address field
      setWallet(address);
      setWalletError("");
    } catch (err: any) {
      setWalletStatus("error");
      if (err.code === 4001) {
        setWalletError("Connection rejected. Please approve the request in your wallet.");
      } else {
        setWalletError(err.message || "Failed to connect wallet.");
      }
    }
  }, []);

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await updateWallet(wallet);
      setSuccess("Wallet address saved! Any pending tokens will be issued shortly.");
      // Refresh user data
      const res = await getMe();
      setUser(res.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to update wallet.");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const shortAddress = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar role="resident" displayName={user.display_name} />
      <main className="max-w-xl mx-auto p-6 space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Profile</h2>

        {/* Account info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Display Name</label>
            <p className="text-gray-900 font-medium mt-1">{user.display_name}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Email</label>
            <p className="text-gray-900 mt-1">{user.email}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Role</label>
            <p className="text-gray-900 capitalize mt-1">{user.role}</p>
          </div>
        </div>

        {/* Wallet section */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="text-green-600" size={20} />
            <h3 className="font-semibold text-gray-900">Polygon Wallet</h3>
          </div>
          <p className="text-sm text-gray-500">
            Link your Polygon-compatible wallet to receive Green Tokens when you submit waste.
          </p>

          {/* Web3 Connect button — always visible if browser supports it */}
          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Browser Wallet (MetaMask)</span>
              {walletStatus === "connected" && connectedAddress ? (
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <CheckCircle size={13} /> Connected
                </span>
              ) : (
                <span className="text-xs text-gray-400">{hasWeb3 ? "Not connected" : "Not detected"}</span>
              )}
            </div>

            {walletStatus === "connected" && connectedAddress ? (
              <div className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2">
                <span className="text-sm font-mono text-green-800">{shortAddress(connectedAddress)}</span>
                <a
                  href={`https://amoy.polygonscan.com/address/${connectedAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                >
                  View on explorer <ExternalLink size={10} />
                </a>
              </div>
            ) : (
              <button
                onClick={handleConnectWallet}
                disabled={walletStatus === "connecting"}
                className="w-full flex items-center justify-center gap-2 border-2 border-green-600 text-green-700 hover:bg-green-50 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
              >
                <Plug size={14} />
                {walletStatus === "connecting" ? "Connecting…" : "Connect Wallet"}
              </button>
            )}

            {!hasWeb3 && (
              <p className="text-xs text-gray-400">
                No wallet extension detected.{" "}
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  Install MetaMask
                </a>{" "}
                to connect automatically.
              </p>
            )}

            {walletError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {walletError}
              </div>
            )}
          </div>

          {/* Manual address input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">
              Or paste address manually
            </label>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Current linked wallet */}
          {user.wallet_address && (
            <div className="text-xs text-gray-500 flex items-center gap-1.5">
              <CheckCircle size={12} className="text-green-500" />
              Currently linked: <span className="font-mono">{shortAddress(user.wallet_address)}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-3 py-2">
              <CheckCircle size={14} /> {success}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={loading || !wallet}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
          >
            <Save size={14} /> {loading ? "Saving…" : "Save Wallet Address"}
          </button>
        </div>
      </main>
    </div>
  );
}
