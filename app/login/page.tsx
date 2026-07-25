"use client";

import React, { useActionState, Suspense } from "react";
import Image from "next/image";
import { login, signup } from "./action";
import { Images } from "@/lib/assets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

function LoginPageContent() {
  const [loginState, loginFormAction, loginPending] = useActionState(login, { error: null, success: null });
  const [signupState, signupFormAction, signupPending] = useActionState(signup, { error: null, success: null });

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
        <div className="relative z-10 p-4 mt-4 bg-surface/40 backdrop-blur-md text-foreground rounded-md w-full self-center gap-2">
          <p className="text-lg font-light">
            &ldquo;Under normal conditions, we will be champions, under abnormal
            conditions we will also be champions.&rdquo;
          </p>
          <p className="text-sm font-medium">José Mourinho</p>
        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="flex flex-col gap-10 w-full h-screen items-center justify-center bg-background text-foreground px-4">
        <div className="relative z-10 mb-6">
          <Image src={Images.logo} height={28} width={186} alt="Logo Image" />
        </div>

        <div className="w-full max-w-md">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-surface">
              <TabsTrigger value="login" className="data-[state=active]:bg-surface-3">Login</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-surface-3">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="mt-6">
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Welcome back</CardTitle>
                  <CardDescription className="text-muted-foreground">
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
                      <Label htmlFor="email" className="text-foreground">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="Enter your email"
                        required
                        className="bg-surface-2 border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-foreground">Password</Label>
                      <Input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        required
                        className="bg-surface-2 border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <Button type="submit" disabled={loginPending} className="w-full bg-accent hover:bg-accent-hover">
                      {loginPending ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="signup" className="mt-6">
              <Card className="bg-surface border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Create account</CardTitle>
                  <CardDescription className="text-muted-foreground">
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
                    <Alert className="border-status-positive/40 bg-status-positive/10">
                      <AlertDescription className="text-status-positive flex flex-col gap-1">
                        <span className="font-semibold text-status-positive">Account created!</span>
                        <span>A confirmation email has been sent to your inbox. Please check your email (and spam folder) and click the link to activate your account before logging in.</span>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <form action={signupFormAction} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-username" className="text-foreground">Username</Label>
                      <Input
                        id="signup-username"
                        name="username"
                        type="text"
                        autoComplete="username"
                        placeholder="Choose a username"
                        required
                        className="bg-surface-2 border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-foreground">Email</Label>
                      <Input
                        id="signup-email"
                        name="email"
                        type="email"
                        placeholder="Enter your email"
                        required
                        className="bg-surface-2 border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-foreground">Password</Label>
                      <Input
                        id="signup-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Create a password"
                        required
                        className="bg-surface-2 border-border text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <Button type="submit" disabled={signupPending} className="w-full bg-accent hover:bg-accent-hover">
                      {signupPending ? "Creating account..." : "Create Account"}
                    </Button>
                  </form>
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
