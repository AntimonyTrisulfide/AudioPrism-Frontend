import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

type LoginForm = { email: string; password: string; remember?: boolean };
type SignupForm = { username: string; email: string; password: string; confirmPassword: string };

type AuthUser = {
  id?: string;
  username?: string;
  email?: string;
};

type AuthPageProps = {
  apiBase?: string;
  onAuthenticated?: (token: string, user?: AuthUser | null) => void;
};

export default function AuthPage({ apiBase = "/api/auth", onAuthenticated }: AuthPageProps) {
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const normalizedBase = useMemo(() => apiBase.replace(/\/$/, ""), [apiBase]);
  const buildUrl = (path: string) => {
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return normalizedBase ? `${normalizedBase}${suffix}` : suffix;
  };

  const {
    register: regLogin,
    handleSubmit: handleLogin,
    control: loginControl,
    formState: { errors: loginErrors },
  } = useForm<LoginForm>({
    defaultValues: { remember: true },
  });

  const {
    register: regSignup,
    handleSubmit: handleSignup,
    formState: { errors: signupErrors },
  } = useForm<SignupForm>();

  async function requestJson(path: string, payload: any) {
    setLoading(true);
    try {
      const res = await fetch(buildUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {}
      setLoading(false);
      if (!res.ok) {
        const msg = (data && data.message) || text || `HTTP ${res.status}`;
        toast.error(msg);
        throw new Error(msg);
      }
      return data;
    } catch (err: any) {
      setLoading(false);
      toast.error(err?.message || String(err) || "Request failed");
      throw err;
    }
  }

  const onLogin = handleLogin(async (vals: LoginForm) => {
    try {
      const data = await requestJson("/login", { email: vals.email, password: vals.password });
      if (data?.token) {
        localStorage.setItem("auth_token", data.token);
        onAuthenticated?.(data.token, data.user);
      }
      toast.success("Logged in successfully");
    } catch (e) {
      // already handled / toasted in requestJson
    }
  });

  const onSignup = handleSignup(async (vals: SignupForm) => {
    if (vals.password !== vals.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await requestJson("/register", { username: vals.username, email: vals.email, password: vals.password });
      toast.success("Account created. Please login.");
      setMode("login");
    } catch (e) {
      // handled in requestJson
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="grid w-full max-w-5xl gap-10 rounded-2xl border border-white/10 bg-slate-950/70 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl md:grid-cols-[1fr_1.1fr]">
        <section className="space-y-6">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.45em] text-indigo-200">SegmentNet</p>
            <h1 className="mt-3 text-3xl font-semibold">Stem splitting without the fluff.</h1>
            <p className="mt-2 text-sm text-slate-300">SegmentNet breaks any mix into clean drums, brass, bass, guitar, vocals, and FX layers in a single pass.</p>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            {["Upload audio", "Choose stems", "Download parts"].map((step, idx) => (
              <div key={step} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <span className="text-white">{step}</span>
                <span className="text-xs text-slate-400">0{idx + 1}</span>
              </div>
            ))}
          </div>
        </section>

        <Card className="border-white/10 bg-slate-900/80 text-white">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Access SegmentNet</CardTitle>
            <CardDescription className="text-slate-300">Minimal login & signup card. Nothing extra.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}> 
              <TabsList className="grid w-full grid-cols-2 bg-white/10 text-white">
                <TabsTrigger value="login" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">Login</TabsTrigger>
                <TabsTrigger value="signup" className="data-[state=active]:bg-white data-[state=active]:text-slate-900">Sign up</TabsTrigger>
              </TabsList>

              <div className="mt-6 text-left">
                <TabsContent value="login" className="focus-visible:outline-none">
                  <form onSubmit={onLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" placeholder="you@segment.net" {...regLogin("email", { required: "Email required" })} />
                      {loginErrors.email && <p className="text-xs text-red-400">{loginErrors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <Input id="login-password" type="password" placeholder="••••••••" {...regLogin("password", { required: "Password required" })} />
                      {loginErrors.password && <p className="text-xs text-red-400">{loginErrors.password.message}</p>}
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-300">
                      <label className="flex cursor-pointer items-center gap-2">
                        <Controller
                          name="remember"
                          control={loginControl}
                          render={({ field }) => (
                            <Checkbox checked={field.value} onCheckedChange={(val) => field.onChange(Boolean(val))} />
                          )}
                        />
                        <span>Remember me</span>
                      </label>
                      <a className="text-xs text-indigo-200 hover:text-indigo-100" href="/forgot">
                        Forgot?
                      </a>
                    </div>

                    <Button type="submit" className="h-11 w-full" disabled={loading}>
                      {loading ? "Authenticating..." : "Login"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="focus-visible:outline-none">
                  <form onSubmit={onSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Username</Label>
                      <Input placeholder="segmentnerd" {...regSignup("username", { required: "Username required" })} />
                      {signupErrors.username && <p className="text-xs text-red-400">{signupErrors.username.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input placeholder="you@segment.net" {...regSignup("email", { required: "Email required" })} />
                      {signupErrors.email && <p className="text-xs text-red-400">{signupErrors.email.message}</p>}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          placeholder="••••••"
                          {...regSignup("password", {
                            required: "Password required",
                            minLength: { value: 6, message: "Min 6 chars" },
                          })}
                        />
                        {signupErrors.password && <p className="text-xs text-red-400">{signupErrors.password.message}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label>Confirm password</Label>
                        <Input
                          type="password"
                          placeholder="Repeat"
                          {...regSignup("confirmPassword", { required: "Confirm password" })}
                        />
                        {signupErrors.confirmPassword && (
                          <p className="text-xs text-red-400">{signupErrors.confirmPassword.message}</p>
                        )}
                      </div>
                    </div>

                    <Button type="submit" className="h-11 w-full" disabled={loading}>
                      {loading ? "Creating account..." : "Create account"}
                    </Button>
                  </form>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-center text-xs text-slate-400">
            <p>SegmentNet keeps your splits synced across devices.</p>
            <p className="text-slate-500">Built by me. Feedback is welcome.</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
