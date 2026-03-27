"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getRatingColorClasses } from "@/utils/ratingColors";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { useLeague } from "@/contexts/LeagueContext";
import { toast } from "sonner";

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
  origin_details: any;
  discounts: Array<{
    type: string;
    percentage: number;
    applied_at: string;
    is_active: boolean;
  }>;
};

type ContractSummary = {
  team_id: string;
  team_name: string;
  total_players: number;
  total_base_salary: number;
  total_final_salary: number;
  total_savings: number;
  avg_rating: number;
  players_by_position: {
    GK: number;
    DEF: number;
    MID: number;
    FWD: number;
  };
};

const StatsCard = ({
  title,
  value,
  subtitle,
  statusColor,
  icon,
}: {
  title: string;
  value: string;
  subtitle?: string;
  statusColor?: string;
  icon?: React.ReactNode;
}) => (
  <Card className="justify-center h-fit">
    <CardContent className="flex flex-col p-4 gap-1 justify-center">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xl text-muted-foreground">{title}</p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="text-xl font-semibold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </CardContent>
  </Card>
);

// Helper function to format salary in millions
const formatSalary = (salary: number) => {
  if (salary >= 1000000) {
    return `$${(salary / 1000000).toFixed(1)}M`;
  } else if (salary >= 1000) {
    return `$${(salary / 1000).toFixed(0)}K`;
  }
  return `$${salary.toLocaleString()}`;
};

const ContractCard = ({ contract }: { contract: Contract }) => {
  const savings = contract.base_wage - contract.final_wage;
  const savingsPercentage = contract.base_wage > 0 ? (savings / contract.base_wage) * 100 : 0;

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-neutral-800">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
          <span className="text-white font-bold text-sm">
            {contract.player_name.replace(/-/g, ' ').split(' ').map(n => n[0]).join('').toUpperCase()}
          </span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{contract.player_name.replace(/-/g, ' ')}</p>
            <Badge className={getRatingColorClasses(contract.rating)}>{contract.rating}</Badge>
            <Badge variant="outline" className="text-xs">
              {contract.origin_type}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm">{contract.positions}</p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">Contract Value: {formatSalary(contract.contract_value)}</p>
            {contract.discounts.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <TrendingDown className="h-3 w-3 text-green-500" />
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
      <div className="text-right">
        <div className="flex flex-col items-end gap-1">
          <p className="font-semibold">{formatSalary(contract.final_wage)}/season</p>
          {savings > 0 && (
            <p className="text-xs text-green-500">
              -{formatSalary(savings)}/season ({savingsPercentage.toFixed(1)}%)
            </p>
          )}
          <p className="text-xs text-muted-foreground line-through">
            {formatSalary(contract.base_wage)}/season
          </p>
          <Button variant="outline" size="sm" className="mt-2 text-red-500 hover:text-red-700">
            Release Player
          </Button>
        </div>
      </div>
    </div>
  );
};

const ContractList = ({ contracts }: { contracts: Contract[] }) => (
  <div className="p-4">
    {contracts.map((contract) => (
      <ContractCard key={contract.player_id} contract={contract} />
    ))}
  </div>
);

const ContractsPage = () => {
  const searchParams = useSearchParams();
  const leagueId = searchParams.get('league');
  const { selectedTeam, selectedLeagueId } = useLeague();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [financialData, setFinancialData] = useState<any>(null);

  // Debug logs
  console.log('Contracts Page: Debug info:', {
    leagueId,
    selectedLeagueId,
    selectedTeam,
    hasSelectedTeam: !!selectedTeam,
    selectedTeamId: selectedTeam?.id
  });

  useEffect(() => {
    console.log('Contracts Page: useEffect triggered with:', { leagueId, selectedTeam });
    
    if (!leagueId) {
      console.log('Contracts Page: No leagueId found');
      setError("No league selected");
      setLoading(false);
      return;
    }

    // Wait a bit for selectedTeam to load, then fetch data
    const timer = setTimeout(() => {
      console.log('Contracts Page: LeagueId found, fetching data');
      fetchContracts();
      fetchSummary();
      fetchFinancialData();
    }, 500);

    return () => clearTimeout(timer);
  }, [leagueId, selectedTeam]);

  const fetchContracts = async () => {
    try {
      setLoading(true);
      let teamId = selectedTeam?.id;
      
      console.log('Contracts Page: Starting fetchContracts with teamId:', teamId);
      
      // If selectedTeam is not available, try to get team from API
      if (!teamId && leagueId) {
        console.log('Contracts Page: selectedTeam not available, fetching team from API');
        try {
          const teamResponse = await fetch(`/api/user/team/${leagueId}`);
          console.log('Contracts Page: Team API response status:', teamResponse.status);
          
          if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            teamId = teamData.id;
            console.log('Contracts Page: Got team from API:', teamId);
          } else {
            console.error('Contracts Page: Team API error:', teamResponse.status, teamResponse.statusText);
          }
        } catch (error) {
          console.error('Contracts Page: Error fetching team from API:', error);
        }
      }
      
      console.log('Contracts Page: Final teamId:', teamId);
      
      if (!teamId) {
        console.error('Contracts Page: Could not determine team ID');
        setError("Could not determine team ID - please refresh the page");
        setLoading(false);
        return;
      }
      
      const response = await fetch(`/api/league/contracts?type=all&teamId=${teamId}&leagueId=${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        setContracts(data.data || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to fetch contracts");
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setError("An error occurred while fetching contracts");
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      let teamId = selectedTeam?.id;
      
      // If selectedTeam is not available, try to get team from API
      if (!teamId && leagueId) {
        try {
          const teamResponse = await fetch(`/api/user/team/${leagueId}`);
          if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            teamId = teamData.id;
          }
        } catch (error) {
          console.error('Contracts Page: Error fetching team from API in summary:', error);
        }
      }
      
      const response = await fetch(`/api/league/contracts?type=summary&leagueId=${leagueId}`);
      if (response.ok) {
        const data = await response.json();
        const teamSummary = data.data?.find((s: ContractSummary) => s.team_id === teamId);
        setSummary(teamSummary || null);
      }
    } catch (error) {
      console.error("Error fetching summary:", error);
    }
  };

  const fetchFinancialData = async () => {
    try {
      let teamId = selectedTeam?.id;
      
      if (!teamId && leagueId) {
        try {
          const teamResponse = await fetch(`/api/user/team/${leagueId}`);
          if (teamResponse.ok) {
            const teamData = await teamResponse.json();
            teamId = teamData.id;
          }
        } catch (error) {
          console.error('Contracts Page: Error fetching team from API in finances:', error);
        }
      }
      
      if (teamId) {
        const response = await fetch(`/api/team/${teamId}/finances`);
        if (response.ok) {
          const data = await response.json();
          setFinancialData(data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching financial data:", error);
    }
  };

  const allContracts = contracts;
  const discountedContracts = contracts.filter((c) => c.discounts.length > 0);
  const packedContracts = contracts.filter((c) => c.origin_type === 'packed');
  const draftedContracts = contracts.filter((c) => c.origin_type === 'drafted');

  const totalBaseWage = contracts.reduce((sum, contract) => sum + contract.base_wage, 0);
  const totalFinalWage = contracts.reduce((sum, contract) => sum + contract.final_wage, 0);
  const totalSavings = totalBaseWage - totalFinalWage;
  
  // Financial data calculations
  const availableBudget = financialData?.finances?.availableBalance || 0;
  const totalBudget = financialData?.finances?.totalBudget || 0;
  const budgetStatus = availableBudget >= 0 ? 'Healthy' : 'Over Budget';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading contracts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Contracts</h2>
        <Button 
          variant="outline" 
          onClick={async () => {
            try {
              const response = await fetch('/api/league/contracts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'recalculate_wages' })
              });
              
              if (response.ok) {
                const result = await response.json();
                toast.success(`Recalculated wages for ${result.data.updated_count} contracts`);
                fetchContracts();
                fetchSummary();
              } else {
                toast.error('Failed to recalculate wages');
              }
            } catch (error) {
              toast.error('Error recalculating wages');
            }
          }}
        >
          Recalculate Wages
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Active Contracts"
          value={`${allContracts.length}`}
          subtitle="Total contracts"
        />
        <StatsCard
          title="Total Wage Bill"
          value={`${formatSalary(totalBaseWage)}/season`}
          subtitle="Based on player ratings"
          icon={<TrendingDown className="h-4 w-4 text-green-500" />}
        />
        <StatsCard
          title="Available Budget"
          value={`${formatSalary(availableBudget)}`}
          subtitle="After wage commitments"
          icon={<Info className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Financial Summary */}
      {financialData && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Overview</CardTitle>
            <CardDescription>
              Wage breakdown and available budget for transfers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-destructive">
                  {formatSalary(totalBaseWage)}
                </div>
                <div className="text-sm text-muted-foreground">Committed to Wages</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className={`text-2xl font-bold ${availableBudget >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {formatSalary(availableBudget)}
                </div>
                <div className="text-sm text-muted-foreground">Available for Transfers</div>
              </div>
            </div>
            
            {/* Wage Breakdown by Position */}
            {financialData.wageBreakdown?.byPosition && (
              <div>
                <h4 className="text-sm font-medium mb-3">Wage Breakdown by Position</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-muted rounded-lg border">
                    <div className="text-lg font-bold text-blue-600">
                      {formatSalary(financialData.wageBreakdown.byPosition.GK)}
                    </div>
                    <div className="text-xs text-muted-foreground">Goalkeepers</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg border">
                    <div className="text-lg font-bold text-green-600">
                      {formatSalary(financialData.wageBreakdown.byPosition.DEF)}
                    </div>
                    <div className="text-xs text-muted-foreground">Defenders</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg border">
                    <div className="text-lg font-bold text-yellow-600">
                      {formatSalary(financialData.wageBreakdown.byPosition.MID)}
                    </div>
                    <div className="text-xs text-muted-foreground">Midfielders</div>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg border">
                    <div className="text-lg font-bold text-red-600">
                      {formatSalary(financialData.wageBreakdown.byPosition.FWD)}
                    </div>
                    <div className="text-xs text-muted-foreground">Forwards</div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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

        <TabsContent value="all">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-lg font-semibold mb-4">All Contracts</h4>
              <ScrollArea className="h-[400px]">
                <ContractList contracts={allContracts} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discounted">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-lg font-semibold mb-4">Contracts with Wage Discounts</h4>
              <ScrollArea className="h-[400px]">
                <ContractList contracts={discountedContracts} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packed">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-lg font-semibold mb-4">Packed Players</h4>
              <ScrollArea className="h-[400px]">
                <ContractList contracts={packedContracts} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafted">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-lg font-semibold mb-4">Drafted Players</h4>
              <ScrollArea className="h-[400px]">
                <ContractList contracts={draftedContracts} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContractsPage;
