"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { Images } from "@/lib/assets";

type ImageKeys = keyof typeof Images;

type Transaction = {
  id: any;
  icon: ImageKeys;
  title: any;
  subtitle: any;
  fromClub?: ImageKeys;
  toClub?: ImageKeys;
  amount: any;
};

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 1,
    icon: Images.JN,
    title: "João Neves",
    subtitle: "CM",
    fromClub: "Benfica",
    toClub: "Benfica",
    amount: -1999,
  },
  {
    id: 2,
    icon: Images.Nike,
    title: "Nike",
    subtitle: "Sponsorship",
    fromClub: "MC",
    toClub: undefined,
    amount: +1999,
  },
  {
    id: 3,
    icon: Images.JN,
    title: "João Neves",
    subtitle: "CM",
    fromClub: "MC",
    toClub: "LU",
    amount: -1750,
  },
  {
    id: 4,
    icon: Images.Nike,
    title: "Nike",
    subtitle: "Sponsorship",
    fromClub: "MC",
    toClub: undefined,
    amount: +1333,
  },
  {
    id: 5,
    icon: Images.Loan, // placeholder circle image
    title: "60M Loan",
    subtitle: "Loan",
    fromClub: "MC",
    toClub: undefined,
    amount: +60000000,
  },
  {
    id: 6,
    icon: Images.Loan, // placeholder circle image
    title: "Loan",
    subtitle: "Loan",
    fromClub: "MC",
    toClub: undefined,
    amount: +60000000,
  },
  {
    id: 7,
    icon: Images.Prime,
    title: "S6 Prime",
    subtitle: "Pack",
    fromClub: "MC",
    toClub: undefined,
    amount: -1999,
  },
  {
    id: 8,
    icon: Images.JN,
    title: "João Neves",
    subtitle: "CM",
    fromClub: "Benfica",
    toClub: "Benfica",
    amount: -1999,
  },
];

const STATS = [
  { title: "Current Balance", value: "$65.4M" },
  { title: "Total Income", value: "$43.3M" },
  { title: "Total Expenses", value: "$13.3M" },
  { title: "Net Balance", value: "+$23.3M" },
];

export default function TransactionsPage() {
  const [tab, setTab] = React.useState("all");

  const filtered = React.useMemo(() => {
    switch (tab) {
      case "income":
        return MOCK_TRANSACTIONS.filter((tx) => tx.amount > 0);
      case "expenses":
        return MOCK_TRANSACTIONS.filter((tx) => tx.amount < 0);
      case "packs":
        return MOCK_TRANSACTIONS.filter((tx) => tx.subtitle === "Pack");
      case "transfers":
        return MOCK_TRANSACTIONS.filter((tx) => tx.subtitle === "Transfer");
      default:
        return MOCK_TRANSACTIONS;
    }
  }, [tab]);

  return (
    <div className="p-8 flex flex-col gap-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <Card key={s.title}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{s.title}</p>
              <p className="mt-1 text-xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Transactions Overview</h2>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="rounded-full bg-muted p-1 flex space-x-2">
            <TabsTrigger value="all" className="flex-1">
              All Transactions
            </TabsTrigger>
            <TabsTrigger value="income" className="flex-1">
              Club Related Income
            </TabsTrigger>
            <TabsTrigger value="expenses" className="flex-1">
              Club Related Expenses
            </TabsTrigger>
            <TabsTrigger value="packs" className="flex-1">
              Packs
            </TabsTrigger>
            <TabsTrigger value="transfers" className="flex-1">
              Transfers
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[500px] rounded-lg border border-neutral-700">
          <div className="space-y-2 p-4 flex flex-col gap-4">
            {filtered.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-[240px]">
                  <div className="w-10 h-10 rounded-full bg-white overflow-hidden">
                    <Image src={tx.icon} alt="" width={40} height={40} />
                  </div>
                  <div>
                    <p className="font-medium">{tx.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {tx.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-1 justify-center">
                  {tx.fromClub && (
                    <Image
                      src={Images[tx.fromClub]}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                  )}
                  {tx.toClub && (
                    <>
                      <span>→</span>
                      <Image
                        src={Images[tx.toClub]}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    </>
                  )}
                </div>

                {/* Amount */}
                <div className="min-w-[96px] text-right">
                  <span
                    className={
                      tx.amount >= 0
                        ? "text-green-500 font-semibold"
                        : "text-red-500 font-semibold"
                    }
                  >
                    {tx.amount >= 0 ? "+" : "-"}$
                    {Math.abs(tx.amount).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
