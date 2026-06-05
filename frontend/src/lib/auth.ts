import Cookies from "js-cookie";

export function isLoggedIn(): boolean {
  return !!Cookies.get("access_token");
}

export function logout() {
  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
  window.location.href = "/login";
}

export function getRole(): string | null {
  const token = Cookies.get("access_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}
