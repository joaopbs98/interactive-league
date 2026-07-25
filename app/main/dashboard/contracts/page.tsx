"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingDown } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Images } from "@/lib/assets";

type Contract = {
  player_id: string;
  player_name: string;
  positions: string;
  rating: number;
  team_id: string;
  team_name: string;
  base_wage: number;
  final_wage: number;
  contract_value: number;
  origin_type: string;
  image?: string;
  origin_details: any;
  discounts: Array<{
    type: string;
    percentage: number;
    applied_at: string;
    is_active: boolean;
  }>;
};

type FinancialData = {
  finances?: { availableBalance?: number; totalBudget?: number };
  wageBreakdown?: { byPosition?: { GK: number; DEF: number; MID: number; FWD: number } };
};

// Format wage in the league's currency
const formatSalary = (salary: number) => {
  if (salary >= 1_000_000) return `€${(salary / 1_000_000).toFixed(1)}M`;
  if (salary >= 1_000) return `€${(salary / 1_000).toFixed(0)}K`;
  return `€${salary.toLocaleString()}`;
};

const ORIGIN_LABELS: Record<string, string> = {
  packed: "Packed",
  drafted: "Drafted",
  signed: "Signed",
  trade: "Trade",
};

const humanizeOrigin = (origin: string) =>
  ORIGIN_LABELS[origin] ||
  origin
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

const ContractCard = ({ contract }: { contract: Contract }) => {
  const savings = contract.base_wage - contract.final_wage;
  const savingsPercentage = contract.base_wage > 0 ? (savings / contract.base_wage) * 100 : 0;
  const playerName = contract.player_name.replace(/-/g, " ");

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border/60">
      <div className="flex items-center gap-4 min-w-0">
        <img
          src={contract.image || Images.NoImage.src}
          alt=""
          className="w-12 h-12 rounded-lg object-cover ring-1 ring-border shrink-0"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate">{playerName}</p>
            <Badge className={getRatingColorClasses(contract.rating)}>{contract.rating}</Badge>
            <Badge variant="outline" className="text-xs">
              {humanizeOrigin(contract.origin_type)}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{contract.positions}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">Contract Value: {formatSalary(contract.contract_value)}</p>
            {contract.discounts.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <TrendingDown className="h-3 w-3 text-status-positive" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs">
                      <p className="font-semibold">Wage Discounts:</p>
                      {contract.discounts.map((discount, index) => (
                        <p key={index}>
                          {discount.type}: -{discount.percentage}%
                        </p>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="flex flex-col items-end gap-1">
          <p className="font-semibold tabular-nums">{formatSalary(contract.final_wage)}/season</p>
          {savings > 0 && (
            <p className="text-xs text-status-positive tabular-nums">
              -{formatSalary(savings)}/season ({savingsPercentage.toFixed(1)}%)
            </p>
          )}
          <p className="text-xs text-muted-foreground line-through tabular-nums">
            {formatSalary(contract.base_wage)}/season
          </p>
          <Button variant="outline" size="sm" className="mt-2 text-status-negative hover:text-status-negative hover:border-status-negative/40">
            Release Player
          </Button>
        </div>
      </div>
    </div>
  );
};

const ContractList = ({ contracts, emptyLabel }: { contracts: Contract[]; emptyLabel: string }) =>
  contracts.length === 0 ? (
    <p className="text-sm text-muted-foreground text-center py-12">{emptyLabel}</p>
  ) : (
    <div>
      {contracts.map((contract) => (
        <ContractCard key={contract.player_id} contract={contract} />
      ))}
    </div>
  );

const ContractsPage = () => {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get("league");
  const { selectedTeam, selectedLeagueId } = useLeague();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);

  const effectiveLeagueId = leagueId || selectedLeagueId;

  useEffect(() => {
    if (!effectiveLeagueId) {
      setError("No league selected");
      setLoading(false);
      return;
    }
    if (!selectedTeam?.id) return; // wait for team context to resolve

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [contractsRes, financeRes] = await Promise.all([
          fetch(`/api/league/contracts?type=all&teamId=${selectedTeam.id}&leagueId=${effectiveLeagueId}`),
          fetch(`/api/team/${selectedTeam.id}/finances`),
        ]);

        if (contractsRes.ok) {
          const data = await contractsRes.json();
          setContracts(data.data || []);
        } else {
          const errorData = await contractsRes.json();
          setError(errorData.error || "Failed to fetch contracts");
        }

        if (financeRes.ok) {
          const data = await financeRes.json();
          setFinancialData(data.data);
        }
      } catch {
        setError("An error occurred while fetching contracts");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [effectiveLeagueId, selectedTeam?.id]);

  const refetchContracts = async () => {
    if (!selectedTeam?.id || !effectiveLeagueId) return;
    const res = await fetch(`/api/league/contracts?type=all&teamId=${selectedTeam.id}&leagueId=${effectiveLeagueId}`);
    if (res.ok) {
      const data = await res.json();
      setContracts(data.data || []);
    }
  };

  const allContracts = contracts;
  const discountedContracts = contracts.filter((c) => c.discounts.length > 0);
  const packedContracts = contracts.filter((c) => c.origin_type === "packed");
  const draftedContracts = contracts.filter((c) => c.origin_type === "drafted");

  const totalBaseWage = contracts.reduce((sum, contract) => sum + contract.base_wage, 0);
  const availableBudget = financialData?.finances?.availableBalance || 0;
  const byPosition = financialData?.wageBreakdown?.byPosition;

  if (loading) {
    return (
      <div className="p-8">
        <PageSkeleton variant="page" rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col gap-6">
        <Breadcrumbs />
        <PageHeader eyebrow="Team Management" title="Contracts" />
        <Card className="bg-surface border-border">
          <CardContent className="p-8 text-center text-status-negative">{error}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6">
      <Breadcrumbs />
      <PageHeader
        eyebrow="Team Management"
        title="Contracts"
        subtitle="Wage bill, discounts, and budget headroom for your squad"
        stats={[
          { label: "Contracts", value: allContracts.length, emphasis: true },
          { label: "Wage Bill", value: formatSalary(totalBaseWage) },
          { label: "Budget", value: formatSalary(availableBudget) },
        ]}
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const response = await fetch("/api/league/contracts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "recalculate_wages" }),
                });
                if (response.ok) {
                  const result = await response.json();
                  toast.success(`Recalculated wages for ${result.data.updated_count} contracts`);
                  refetchContracts();
                } else {
                  toast.error("Failed to recalculate wages");
                }
              } catch {
                toast.error("Error recalculating wages");
              }
            }}
          >
            Recalculate Wages
          </Button>
        }
      />

      {/* Wage breakdown — the one place this data appears, not duplicated across separate stat cards */}
      {byPosition && (
        <div className="rounded-lg border border-border-strong bg-surface overflow-hidden">
          <div className="px-6 pt-5 pb-1">
            <h2 className="font-display text-2xl">Wage Breakdown</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-border mt-3">
            {([
              ["Goalkeepers", byPosition.GK, "text-accent"],
              ["Defenders", byPosition.DEF, "text-status-positive"],
              ["Midfielders", byPosition.MID, "text-status-warning"],
              ["Forwards", byPosition.FWD, "text-status-negative"],
            ] as const).map(([label, value, color]) => (
              <div key={label} className="p-4 text-center">
                <div className={`text-lg font-bold tabular-nums ${color}`}>{formatSalary(value)}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full flex">
          <TabsTrigger value="all" className="flex-1">
            All Contracts ({allContracts.length})
          </TabsTrigger>
          <TabsTrigger value="discounted" className="flex-1">
            Discounted ({discountedContracts.length})
          </TabsTrigger>
          <TabsTrigger value="packed" className="flex-1">
            Packed ({packedContracts.length})
          </TabsTrigger>
          <TabsTrigger value="drafted" className="flex-1">
            Drafted ({draftedContracts.length})
          </TabsTrigger>
        </TabsList>

        <div className="rounded-lg border border-border-strong bg-surface mt-3">
          <TabsContent value="all" className="m-0">
            <ScrollArea className="h-[420px] px-4">
              <ContractList contracts={allContracts} emptyLabel="No contracts yet." />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="discounted" className="m-0">
            <ScrollArea className="h-[420px] px-4">
              <ContractList contracts={discountedContracts} emptyLabel="No discounted contracts." />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="packed" className="m-0">
            <ScrollArea className="h-[420px] px-4">
              <ContractList contracts={packedContracts} emptyLabel="No packed players." />
            </ScrollArea>
          </TabsContent>
          <TabsContent value="drafted" className="m-0">
            <ScrollArea className="h-[420px] px-4">
              <ContractList contracts={draftedContracts} emptyLabel="No drafted players." />
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default ContractsPage;
