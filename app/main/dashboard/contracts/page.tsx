"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Image from "next/image";
import { Images } from "@/lib/assets";
import { ScrollArea } from "@/components/ui/scroll-area";

type Contract = {
  id: number;
  name: string;
  position: string;
  overall: number;
  seasonsRemaining: number;
  salary: string;
};

const MOCK_CONTRACTS: Contract[] = [
  {
    id: 1,
    name: "João Neves",
    position: "CM",
    overall: 82,
    seasonsRemaining: 1,
    salary: "$1,999.00",
  },
  {
    id: 2,
    name: "João Neves",
    position: "CM",
    overall: 82,
    seasonsRemaining: 1,
    salary: "$1,999.00",
  },
  {
    id: 3,
    name: "João Neves",
    position: "CM",
    overall: 82,
    seasonsRemaining: 1,
    salary: "$1,999.00",
  },
  {
    id: 4,
    name: "João Neves",
    position: "CM",
    overall: 82,
    seasonsRemaining: 2,
    salary: "$1,999.00",
  },
  {
    id: 5,
    name: "João Neves",
    position: "CM",
    overall: 82,
    seasonsRemaining: 3,
    salary: "$1,999.00",
  },
  {
    id: 6,
    name: "João Neves",
    position: "CM",
    overall: 82,
    seasonsRemaining: 1,
    salary: "$1,999.00",
  },
];

const StatsCard = ({
  title,
  value,
  subtitle,
  statusColor,
}: {
  title: string;
  value: string;
  subtitle?: string;
  statusColor?: string;
}) => (
  <Card className="justify-center h-fit">
    <CardContent className="flex flex-col p-4 gap-1 justify-center">
      <p className="text-xl text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-2">
        <div className="text-xl font-semibold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
    </CardContent>
  </Card>
);

const ContractCard = ({ contract }: { contract: Contract }) => (
  <div className="flex items-center justify-between gap-4 py-3 border-b border-neutral-800">
    <div className="flex items-center gap-4">
      <div className="rounded-full bg-white">
        <Image
          src={Images.JN}
          alt="Avatar"
          width={54}
          height={54}
          className="rounded-full"
        />
      </div>
      <div>
        <div className="flex items-center gap-2">
          <p className="font-semibold">{contract.name}</p>
          <Badge className="bg-green-700 text-white">{contract.overall}</Badge>
        </div>
        <p className="text-muted-foreground text-sm">{contract.position}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="text-sm font-light">
        {contract.seasonsRemaining} Season
        {contract.seasonsRemaining > 1 ? "s" : ""} Remaining
      </p>
      <p className="font-semibold">{contract.salary}</p>
    </div>
  </div>
);

const ContractList = ({ contracts }: { contracts: Contract[] }) => (
  <div className="p-4">
    {contracts.map((contract) => (
      <ContractCard key={contract.id} contract={contract} />
    ))}
  </div>
);

const ContractsPage = () => {
  const allContracts = MOCK_CONTRACTS;
  const expiringContracts = MOCK_CONTRACTS.filter(
    (c) => c.seasonsRemaining === 1
  );

  return (
    <div className="p-8 flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Contracts</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Active Contracts"
          value={`${allContracts.length}`}
          subtitle="+20.1% from last season"
        />
        <StatsCard
          title="Expiring Soon"
          value={`${expiringContracts.length}`}
          subtitle="+180.1% from last season"
        />
        <StatsCard
          title="Wage Bill"
          value="$93,000,000"
          subtitle="+19% from last season"
        />
        <StatsCard
          title="Health"
          value="Above Average"
          subtitle="12% Higher than other clubs"
          statusColor="bg-orange-500 text-white"
        />
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="w-full flex">
          <TabsTrigger value="all" className="flex-1">
            All Contracts ({allContracts.length})
          </TabsTrigger>
          <TabsTrigger value="expiring" className="flex-1">
            Expiring Contracts ({expiringContracts.length})
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

        <TabsContent value="expiring">
          <Card>
            <CardContent className="p-4">
              <h4 className="text-lg font-semibold mb-4">Expiring Contracts</h4>
              <ScrollArea className="h-[400px]">
                <ContractList contracts={expiringContracts} />
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContractsPage;
