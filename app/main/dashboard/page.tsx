import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Timeline9 } from "@/components/timeline9";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Images } from "@/lib/assets";
import FormationSelector from "@/components/formationSelector";

const page = () => {
  return (
    <div className="flex flex-col px-8 py-4 gap-8">
      <section className="flex justify-between items-center w-full">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Main</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Dashboard</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="flex gap-8">
          <p className="text-muted-foreground">Season 6</p>
          <Button>Notifications</Button>
        </div>
      </section>

      <section>
        <Alert variant="destructive">
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>
            Sponsor is expiring this season. Check [ Bank & Balance - Sponsors ]
            for more info.
          </AlertDescription>
        </Alert>
      </section>

      <section className="bg-gradient-to-r from-[#161630] via-[#2a2140] to-[#0a0a0a] rounded-md border border-neutral-800 flex p-8">
        <div className="flex flex-col items-center gap-4">
          <Image src={Images.Benfica} height={54} width={54} alt="Logo" />
          <Image src={Images.logo2} height={100} width={200} alt="Logo" />
        </div>
        <div className="flex flex-col justify-between w-full">
          <div className="flex justify-between">
            {[
              { title: "Manager", value: "João Silva" },
              { title: "Club", value: "SL Benfica" },
              { title: "Balance", value: <Badge>24.5M</Badge> },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center w-full">
                <span className="font-bold">{item.title}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
          <div className="h-px bg-white w-[90%] self-center" />
          <div className="flex justify-between">
            {[
              { title: "League Rank", value: "8th Place" },
              { title: "Domestic Cup", value: "Final" },
              { title: "International Competition", value: "Knocked-Out" },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center w-full">
                <span className="font-bold">{item.title}</span>
                <span>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-8">
        <div className="flex flex-col gap-8 flex-1 min-w-[280px]">
          <div className="flex flex-col gap-4 p-4 border border-neutral-800 rounded-lg bg-neutral-950">
            <p className="font-bold text-lg">What to do next</p>
            <div className="flex flex-wrap gap-2">
              {[
                "Open a Pack",
                "Check Draft",
                "Manage Squad",
                "Check Contracts",
              ].map((action, idx) => (
                <Button key={idx} variant="outline" className="flex-grow">
                  {action}
                </Button>
              ))}
              <Button variant="outline" className="w-full">
                Go to the Transfer Hub
              </Button>
            </div>
          </div>
          <ScrollArea className="h-[500px] w-full rounded-md border p-4 bg-neutral-950">
            <Timeline9 />
          </ScrollArea>
        </div>

        <div className="flex flex-col gap-4 flex-1 bg-neutral-950">
          <FormationSelector />
          <div className="flex flex-col gap-4 p-4 border border-neutral-800 rounded-lg">
            <p>MVP of the Week</p>
            <div className="flex items-center gap-4">
              <div className="flex flex-col gap-4 w-full">
                <div className="flex gap-2 justify-center">
                  <p className="font-semibold whitespace-nowrap">João Neves</p>
                  <Badge className="bg-green-800 text-white">84</Badge>
                </div>
                <div className="flex justify-between mx-4">
                  {[
                    { label: "Goals", value: 1 },
                    { label: "Assists", value: 2 },
                    { label: "Average", value: 9.8 },
                  ].map((stat, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <p className="text-neutral-300">{stat.label}</p>
                      <Badge>{stat.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <Image src={Images.Benfica} height={100} width={100} alt="Logo" />
              <Image src={Images.JN} height={100} width={100} alt="Avatar" />
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-8 flex-1 min-w-[280px]">
          <div className="flex flex-col gap-4 p-4 border border-neutral-800 rounded-lg bg-neutral-950">
            <p>User-Set Reminders</p>
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertTitle>Do not forget to renew contracts!</AlertTitle>
              </Alert>
              <Alert>
                <AlertTitle>
                  We need to reach CL otherwise we are cooked...
                </AlertTitle>
              </Alert>
              <Input placeholder="Insert new reminder here" />
            </div>
          </div>
          <div className="flex flex-col gap-4 p-4 border border-neutral-800 rounded-lg bg-neutral-950">
            <p>Upcoming Events</p>
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertTitle>Auction Starting Soon</AlertTitle>
                <AlertDescription>24 Minutes</AlertDescription>
              </Alert>
              <Alert>
                <AlertTitle>Auction Starting Soon</AlertTitle>
                <AlertDescription>28 Minutes</AlertDescription>
              </Alert>
              <Alert>
                <AlertTitle>Auction Starting Soon</AlertTitle>
                <AlertDescription>36 Minutes</AlertDescription>
              </Alert>
              <Alert className="bg-red-800">
                <AlertTitle>Market Closes</AlertTitle>
                <AlertDescription>6 Days</AlertDescription>
              </Alert>
              <Alert className="bg-blue-800">
                <AlertTitle>Squad Submission</AlertTitle>
                <AlertDescription>7 Days</AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default page;
