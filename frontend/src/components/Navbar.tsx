"use client";
import Link from "next/link";
import { Leaf, LogOut } from "lucide-react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

interface NavbarProps {
  role?: "resident" | "administrator";
  displayName?: string;
}

export function Navbar({ role, displayName }: NavbarProps) {
  const router = useRouter();

  const handleLogout = () => {
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    router.push("/login");
  };

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="bg-green-600 text-white p-1.5 rounded-lg">
          <Leaf size={20} />
        </div>
        <span className="font-bold text-gray-900 text-lg">EcoRoute</span>
        {role === "administrator" && (
          <span className="ml-2 bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
            Admin
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {role === "resident" && (
          <>
            <Link href="/portal" className="text-sm text-gray-600 hover:text-green-600 transition-colors">
              Dashboard
            </Link>
            <Link href="/portal/submit" className="text-sm text-gray-600 hover:text-green-600 transition-colors">
              Submit Waste
            </Link>
            <Link href="/portal/profile" className="text-sm text-gray-600 hover:text-green-600 transition-colors">
              Profile
            </Link>
          </>
        )}
        {role === "administrator" && (
          <>
            <Link href="/admin" className="text-sm text-gray-600 hover:text-green-600 transition-colors">
              Dashboard
            </Link>
            <Link href="/admin/routes" className="text-sm text-gray-600 hover:text-green-600 transition-colors">
              Routes
            </Link>
            <Link href="/admin/bins" className="text-sm text-gray-600 hover:text-green-600 transition-colors">
              Bins
            </Link>
          </>
        )}
        {displayName && (
          <span className="text-sm text-gray-700 font-medium">{displayName}</span>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
