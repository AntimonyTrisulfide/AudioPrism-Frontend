import { useEffect, useState } from "react";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";
import { toast } from "sonner";

type UserProfile = {
  id?: string;
  username?: string;
  email?: string;
};

const API_ROOT = (import.meta.env.VITE_API_ROOT as string | undefined)?.replace(/\/$/, "") ?? "";

const withApiRoot = (path: string) => {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return API_ROOT ? `${API_ROOT}${suffix}` : suffix;
};

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("auth_token"));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [checkingSession, setCheckingSession] = useState<boolean>(Boolean(token));

  useEffect(() => {
    if (!token) {
      setUser(null);
      setCheckingSession(false);
      return;
    }

    const controller = new AbortController();

    async function fetchProfile() {
      try {
        setCheckingSession(true);
        const res = await fetch(withApiRoot("/api/auth/me"), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("Session expired");
        }

        const data = await res.json();
        setUser(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        localStorage.removeItem("auth_token");
        setToken(null);
        setUser(null);
        toast.error("Session expired, please log in again");
      } finally {
        if (!controller.signal.aborted) {
          setCheckingSession(false);
        }
      }
    }

    fetchProfile();
    return () => controller.abort();
  }, [token]);

  const handleAuthSuccess = (newToken: string, profile?: UserProfile | null) => {
    localStorage.setItem("auth_token", newToken);
    setToken(newToken);
    if (profile) {
      setUser(profile);
      setCheckingSession(false);
    } else {
      setCheckingSession(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setToken(null);
    setUser(null);
  };

  if (!token) {
    return <AuthPage apiBase={withApiRoot("/api/auth")} onAuthenticated={handleAuthSuccess} />;
  }

  if (checkingSession && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-slate-300">Verifying your session…</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage apiBase={withApiRoot("/api/auth")} onAuthenticated={handleAuthSuccess} />;
  }

  return (
    <HomePage
      apiRoot={API_ROOT}
      token={token}
      user={user}
      onLogout={handleLogout}
    />
  );
}

export default App;
