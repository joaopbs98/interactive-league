import Image from "next/image";
import React from "react";
import { Images } from "@/lib/assets";
import { Register } from "@/components/auth/register";

const Page = () => {
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
            "Under normal conditions, we will be champions, under abnormal
            conditions we will also be champions."
          </p>
          <p className="text-sm font-medium">José Mourinho</p>
        </div>
      </section>
      <section className="flex flex-col  gap-10 w-full h-screen items-center justify-center">
        <div className="relative z-10">
          <Image src={Images.logo} height={28} width={186} alt="Logo Image" />
        </div>
        <Register />
      </section>
    </div>
  );
};

export default Page;
