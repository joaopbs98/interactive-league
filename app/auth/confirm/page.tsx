"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Images } from "@/lib/assets";
import Image from "next/image";

export default function ConfirmPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const confirmEmail = async () => {
      try {
        const supabase = createClient();
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");

        if (!tokenHash || type !== "email") {
          setError("Invalid confirmation link");
          setIsLoading(false);
          return;
        }

        console.log("Confirming email with token:", tokenHash);

        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "email",
        });

        if (error) {
          console.error("Email confirmation error:", error);
          setError(error.message);
        } else {
          console.log("Email confirmed successfully");
          setSuccess(true);
        }
      } catch (err) {
        console.error("Unexpected error during email confirmation:", err);
        setError("An unexpected error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    confirmEmail();
  }, [isClient, searchParams]);

  const handleContinue = () => {
    router.push("/saves");
  };

  const handleTryAgain = () => {
    router.push("/login");
  };

  // Don't render until client-side hydration is complete
  if (!isClient) {
    return (
      <div className="min-h-screen w-full flex bg-background">
        <section className="w-full h-screen relative flex flex-col justify-between p-10">
          <Image
            src={Images.loginBanner}
            alt="Login Background"
            fill
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

        <section className="flex flex-col gap-10 w-full h-screen items-center justify-center bg-neutral-950 text-white px-4">
          <div className="relative z-10 mb-6">
            <Image src={Images.logo} height={28} width={186} alt="Logo Image" />
          </div>

          <div className="w-full max-w-md">
            <Card className="bg-neutral-900 border-neutral-800">
              <CardHeader>
                <CardTitle className="text-white">Loading...</CardTitle>
                <CardDescription className="text-neutral-400">
                  Please wait while we load the confirmation page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-background">
      {/* LEFT SIDE */}
      <section className="w-full h-screen relative flex flex-col justify-between p-10">
        <Image
          src={Images.loginBanner}
          alt="Login Background"
          fill
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
          <Card className="bg-neutral-900 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-white">
                {isLoading ? "Confirming Email..." : success ? "Email Confirmed!" : "Confirmation Error"}
              </CardTitle>
              <CardDescription className="text-neutral-400">
                {isLoading 
                  ? "Please wait while we verify your email address"
                  : success 
                    ? "Your email has been successfully confirmed"
                    : "There was an issue confirming your email"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>
                    Your account has been successfully verified! You can now sign in to your account.
                  </AlertDescription>
                </Alert>
              )}

              {!isLoading && (
                <div className="space-y-3">
                  {success ? (
                    <Button 
                      onClick={handleContinue} 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Continue to Dashboard
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleTryAgain} 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Back to Login
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
} 