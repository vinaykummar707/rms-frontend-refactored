import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/core/auth/useAuth";
import { notify } from "@/core/notifications/notificationService";
import { useTheme } from "@/components/theme-provider";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  BusFront,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Loader2,
  KeyRound,
} from "lucide-react";

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, resetPassword, readRememberedEmail } = useAuth();
  const { theme, setTheme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password dialog state
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    const remembered = readRememberedEmail();
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, [readRememberedEmail]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      notify.warning("Please enter your email address");
      return;
    }
    if (!password) {
      notify.warning("Please enter your password");
      return;
    }

    try {
      setIsSubmitting(true);
      const user = await signIn(trimmedEmail, password, rememberMe);
      notify.success("Welcome back!", `Signed in as ${user.email}`);
      navigate("/home", { replace: true });
    } catch (err: any) {
      notify.error(err.message || "Failed to sign in. Please verify your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = resetEmail.trim() || email.trim();
    if (!trimmed) {
      notify.warning("Please enter your email to receive recovery instructions");
      return;
    }

    try {
      setIsResetting(true);
      await resetPassword(trimmed);
      notify.success("Password reset instructions sent", `Check ${trimmed} for the recovery link.`);
      setIsResetOpen(false);
    } catch (err: any) {
      notify.error(err.message || "Could not send reset email");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-to-b from-background via-muted/20 to-background overflow-hidden">
      {/* Background Subtle Transit Grid Decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Top Controls: Theme Switcher */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full h-9 w-9 text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 transition-transform rotate-0 scale-100" />
          ) : (
            <Moon className="h-4 w-4 transition-transform rotate-0 scale-100" />
          )}
        </Button>
      </div>

      <div className="w-full max-w-[420px] z-10 flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25 ring-4 ring-primary/10">
            <BusFront className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
              Navitronix RMS
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Route Management & Intelligent Passenger Information System
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-border/80 shadow-xl shadow-black/5 bg-card/90 backdrop-blur-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold tracking-tight">Sign In</CardTitle>
            <CardDescription className="text-xs">
              Enter your corporate credentials to access the fleet control portal
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pb-4">
              {/* Email Field */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-foreground">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@transport.gov.in"
                    autoComplete="email"
                    disabled={isSubmitting}
                    className="pl-9 text-sm h-10"
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-foreground">
                    Password
                  </Label>
                  <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                    <DialogTrigger
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setIsResetOpen(true);
                      }}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                          <KeyRound className="h-5 w-5" />
                        </div>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                          Enter your account email to receive a secure link to create a new password.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handlePasswordReset} className="space-y-4 py-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="reset-email" className="text-xs">
                            Account Email
                          </Label>
                          <Input
                            id="reset-email"
                            type="email"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            placeholder="name@transport.gov.in"
                            required
                          />
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsResetOpen(false)}
                            disabled={isResetting}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={isResetting}>
                            {isResetting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              "Send Reset Link"
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    className="pl-9 pr-10 text-sm h-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me Option */}
         
            </CardContent>

            <CardFooter className="pt-2 pb-5 flex flex-col gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 font-medium text-sm transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Sign In "
                )}
              </Button>

             
            </CardFooter>
          </form>
        </Card>

        {/* Footnote */}
        <p className="text-center text-[11px] text-muted-foreground">
          &copy; {new Date().getFullYear()} Navitronix. All rights reserved.
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
