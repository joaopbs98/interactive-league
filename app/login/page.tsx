"use client";

import React, { useState, useActionState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { login, signup } from "./action";
import { Images } from "@/lib/assets";
import { signInWithGoogle } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [loginState, loginFormAction, loginPending] = useActionState(login, { error: null, success: null });
  const [signupState, signupFormAction, signupPending] = useActionState(signup, { error: null, success: null });

  // If OAuth redirected to /login?code=xxx (misconfigured redirect URL), forward to callback
  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      const next = searchParams.get("next") || "/saves";
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
    }
  }, [searchParams]);

  async function handleSignIn() {
    setIsLoading(true);
    try {
      const { url } = await signInWithGoogle("/saves");
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Google sign in error:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* LEFT SIDE */}
      <section className="w-full h-screen relative flex flex-col justify-between p-10">
        <Image
          src={Images.loginBanner}
          alt="Login Background"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 z-0 object-cover"
        />
        <div className="relative z-10">
          <Image src={Images.logo} height={28} width={186} alt="Logo Image" />
        </div>
        <div className="relative z-10 p-4 mt-4 bg-neutral-800/20 backdrop-blur-md text-white rounded-md w-full self-center gap-2">
          <p className="text-lg font-light">
            &ldquo;Under normal conditions, we will be champions, under abnormal
            conditions we will also be champions.&rdquo;
          </p>
          <p className="text-sm font-medium">José Mourinho</p>
        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="flex flex-col gap-10 w-full h-screen items-center justify-center bg-neutral-950 text-white px-4">
        <div className="relative z-10 mb-6">
          <Image src={Images.logo} height={28} width={186} alt="Logo Image" />
        </div>

        <div className="w-full max-w-md">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-neutral-900">
              <TabsTrigger value="login" className="data-[state=active]:bg-neutral-800">Login</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-neutral-800">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="mt-6">
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle className="text-white">Welcome back</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Sign in to your account to continue
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loginState.error && (
                    <Alert variant="destructive">
                      <AlertDescription>{loginState.error}</AlertDescription>
                    </Alert>
                  )}
                  {loginState.success && (
                    <Alert>
                      <AlertDescription>{loginState.success}</AlertDescription>
                    </Alert>
                  )}
                  
                  <form action={loginFormAction} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-white">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="Enter your email"
                        required
                        className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-white">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        required
                        className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                      />
                    </div>
                    <Button type="submit" disabled={loginPending} className="w-full bg-blue-600 hover:bg-blue-700">
                      {loginPending ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-neutral-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-neutral-900 px-2 text-neutral-400">Or continue with</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleSignIn}
                    disabled={isLoading}
                    className="w-full bg-white hover:bg-neutral-100 text-black"
                    variant="outline"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                        Loading...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 16 16"
                          aria-hidden
                          className="size-4"
                        >
                          <g clipPath="url(#google-clip)">
                            <path
                              fill="currentColor"
                              d="M8.32 7.28v2.187h5.227c-.16 1.226-.57 2.124-1.192 2.755-.764.765-1.955 1.6-4.035 1.6-3.218 0-5.733-2.595-5.733-5.813 0-3.218 2.515-5.814 5.733-5.814 1.733 0 3.005.685 3.938 1.565l1.538-1.538C12.498.96 10.756 0 8.32 0 3.91 0 .205 3.591.205 8s3.706 8 8.115 8c2.382 0 4.178-.782 5.582-2.24 1.44-1.44 1.893-3.475 1.893-5.111 0-.507-.035-.978-.115-1.369H8.32Z"
                            />
                          </g>
                          <defs>
                            <clipPath id="google-clip">
                              <path fill="#fff" d="M0 0h16v16H0z" />
                            </clipPath>
                          </defs>
                        </svg>
                        Continue with Google
                      </div>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="signup" className="mt-6">
              <Card className="bg-neutral-900 border-neutral-800">
                <CardHeader>
                  <CardTitle className="text-white">Create account</CardTitle>
                  <CardDescription className="text-neutral-400">
                    Sign up to get started with your account
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {signupState.error && (
                    <Alert variant="destructive">
                      <AlertDescription>{signupState.error}</AlertDescription>
                    </Alert>
                  )}
                  {signupState.success && (
                    <Alert className="border-green-600 bg-green-950/50">
                      <AlertDescription className="text-green-300 flex flex-col gap-1">
                        <span className="font-semibold text-green-200">Account created!</span>
                        <span>A confirmation email has been sent to your inbox. Please check your email (and spam folder) and click the link to activate your account before logging in.</span>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <form action={signupFormAction} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-username" className="text-white">Username</Label>
                      <Input
                        id="signup-username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        placeholder="Choose a username"
                        required
                        className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-white">Email</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        required
                        className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-white">Password</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Create a password"
                        required
                        className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-400"
                      />
                    </div>
                    <Button type="submit" disabled={signupPending} className="w-full bg-blue-600 hover:bg-blue-700">
                      {signupPending ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-neutral-700" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-neutral-900 px-2 text-neutral-400">Or continue with</span>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleSignIn}
                    disabled={isLoading}
                    className="w-full bg-white hover:bg-neutral-100 text-black"
                    variant="outline"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                        Loading...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 16 16"
                          aria-hidden
                          className="size-4"
                        >
                          <g clipPath="url(#google-clip)">
                            <path
                              fill="currentColor"
                              d="M8.32 7.28v2.187h5.227c-.16 1.226-.57 2.124-1.192 2.755-.764.765-1.955 1.6-4.035 1.6-3.218 0-5.733-2.595-5.733-5.813 0-3.218 2.515-5.814 5.733-5.814 1.733 0 3.005.685 3.938 1.565l1.538-1.538C12.498.96 10.756 0 8.32 0 3.91 0 .205 3.591.205 8s3.706 8 8.115 8c2.382 0 4.178-.782 5.582-2.24 1.44-1.44 1.893-3.475 1.893-5.111 0-.507-.035-.978-.115-1.369H8.32Z"
                            />
                          </g>
                          <defs>
                            <clipPath id="google-clip">
                              <path fill="#fff" d="M0 0h16v16H0z" />
                            </clipPath>
                          </defs>
                        </svg>
                        Continue with Google
                      </div>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full flex bg-background items-center justify-center">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
