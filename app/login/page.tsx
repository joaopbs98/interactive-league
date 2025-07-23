"use client";

import React from "react";
import Image from "next/image";
import { login, signup } from "./action";
import { Images } from "@/lib/assets";
import { signInWithGoogle } from "@/actions/auth";

import { Button } from "@/components/ui/button";

export default function LoginPage() {
  async function handleSignIn() {
    const { url } = await signInWithGoogle("/main/dashboard");

    if (url) {
      window.location.href = url;
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
          className="absolute inset-0 z-0 object-cover"
        />
        <div className="relative z-10">
          <Image src={Images.logo} height={28} width={186} alt="Logo Image" />
        </div>
        <div className="relative z-10 p-4 mt-4 bg-neutral-800/20 backdrop-blur-md text-white rounded-md w-full self-center gap-2">
          <p className="text-lg font-light">
            "Under normal conditions, we will be champions, under abnormal
            conditions we will also be champions."
          </p>
          <p className="text-sm font-medium">José Mourinho</p>
        </div>
      </section>

      {/* RIGHT SIDE */}
      <section className="flex flex-col gap-10 w-full h-screen items-center justify-center bg-neutral-950 text-white px-4">
        <div className="relative z-10 mb-6">
          <Image src={Images.logo} height={28} width={186} alt="Logo Image" />
        </div>

        <div className="w-full max-w-sm flex flex-col items-center space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-neutral-400 mt-2">
              Use your Google account to continue.
            </p>
          </div>

          <form action={handleSignIn} className="w-full">
            <Button
              className="flex w-full items-center justify-center gap-x-3 bg-white hover:bg-neutral-100"
              variant="outline"
              type="submit"
            >
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
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
