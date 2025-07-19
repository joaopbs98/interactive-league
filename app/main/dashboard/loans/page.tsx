"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

export default function LoansPage() {
  // Narrow state type for tabs
  const [tab, setTab] = useState<"overview" | "restructuring">("overview");

  // Mocked data
  const currentDebt = "$50,000,000";
  const nextPayment = "$25,000,000";
  const paidToDate = "$15,000,000";
  const interestRate = "25%";

  const loanDetails = {
    originalAmount: "$60,000,000",
    rate: "25%",
    seasonTaken: "Season 5",
    period: "3 Seasons",
    finalPayment: "Season 8",
    status: "Active" as const,
  };

  const paymentsMade = 1;
  const totalPayments = 3;
  const totalPaid = "$25,000,000";
  const remaining = "$50,000,000";

  return (
    <div className="p-8 flex flex-col gap-8 bg-background text-foreground">
      {/* Page Header */}
      <h2 className="text-2xl font-semibold">Loans Overview</h2>

      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Current Debt</p>
            <p className="text-xl font-semibold">{currentDebt}</p>
            <p className="text-xs text-muted-foreground">Season 5 Loan</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Next Payment</p>
            <p className="text-xl font-semibold">{nextPayment}</p>
            <p className="text-xs text-muted-foreground">Due Season 6</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Paid to Date</p>
            <p className="text-xl font-semibold">{paidToDate}</p>
            <p className="text-xs text-muted-foreground">
              +19% from last season
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1">
            <p className="text-sm text-muted-foreground">Interest Rate</p>
            <p className="text-xl font-semibold">{interestRate}</p>
            <p className="text-xs text-muted-foreground">Fixed Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="outline">Early Payoff</Button>
        <Button>New Loan +</Button>
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(value: string) =>
          setTab(value as "overview" | "restructuring")
        }
        className="space-y-4"
      >
        <TabsList className="rounded-full bg-muted p-1 w-max">
          <TabsTrigger
            value="overview"
            className="px-4 data-[state=active]:bg-background"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="restructuring"
            className="px-4 data-[state=active]:bg-background"
          >
            Restructuring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loan Details */}
            <Card className="bg-card border-border">
              <CardContent className="space-y-4">
                <h3 className="text-lg font-semibold">Season 5 Loan Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Original Amount</span>
                    <span className="text-red-500">
                      {loanDetails.originalAmount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interest Rate</span>
                    <span>{loanDetails.rate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Season Taken</span>
                    <span>{loanDetails.seasonTaken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Loan Period</span>
                    <span>{loanDetails.period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Final Payment</span>
                    <span>{loanDetails.finalPayment}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Loan Status</span>
                    <Badge
                      variant="outline"
                      className="bg-yellow-500 text-black"
                    >
                      {loanDetails.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Progress */}
            <Card className="bg-card border-border">
              <CardContent className="space-y-4">
                <h3 className="text-lg font-semibold">Payment Progress</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Payments Made</span>
                    <span>
                      {paymentsMade} of {totalPayments} (
                      {Math.round((paymentsMade / totalPayments) * 100)}%)
                    </span>
                  </div>
                  <Progress
                    value={(paymentsMade / totalPayments) * 100}
                    className="h-2 bg-muted"
                  />
                </div>
                <Separator className="my-4" />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Paid</span>
                    <span className="text-green-500 font-semibold">
                      {totalPaid}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remaining Balance</span>
                    <span className="text-red-500 font-semibold">
                      {remaining}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="restructuring">
          <Card className="bg-card border-border">
            <CardContent className="text-center text-muted-foreground py-16">
              Restructuring tools coming soon.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
