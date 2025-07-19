import {
  Calendar,
  Home,
  Inbox,
  Search,
  Settings,
  Shield,
  Users,
  Trophy,
  Banknote,
  Shuffle,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Slider } from "../ui/slider";
import { Avatar } from "../ui/avatar";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";
import { Combobox } from "../inputs/combobox";

const sidebarSections = [
  {
    section: "Overview",
    items: [
      { title: "Season Overview", icon: Shield, url: "/main/dashboard" },
      { title: "CompIndex", icon: Shield, url: "/main/dashboard/compindex" },
    ],
  },
  {
    section: "Team Management",
    items: [
      {
        title: "Tactics & Formation",
        icon: Users,
        url: "/main/dashboard/tactics",
      },
      { title: "Contracts", icon: Users, url: "/main/dashboard/contracts" },
      {
        title: "Injuries & Suspensions",
        icon: Users,
        url: "/main/dashboard/injuries",
      },
    ],
  },
  {
    section: "League",
    items: [
      { title: "Standings", icon: Trophy, url: "/main/dashboard/standings" },
      { title: "Schedule", icon: Trophy, url: "/main/dashboard/schedule" },
      { title: "Hall of Fame", icon: Trophy, url: "/main/dashboard/hof" },
      { title: "History & Stats", icon: Trophy, url: "/main/dashboard/stats" },
    ],
  },
  {
    section: "Bank & Balance",
    items: [
      {
        title: "Transactions",
        icon: Banknote,
        url: "/main/dashboard/transactions",
      },
      { title: "Sponsors", icon: Banknote, url: "/main/dashboard/sponsors" },
      { title: "Loans", icon: Banknote, url: "/main/dashboard/loans" },
    ],
  },
  {
    section: "Transfer Hub",
    items: [
      { title: "Packs", icon: Shuffle, url: "/main/dashboard/packs" },
      { title: "Draft", icon: Shuffle, url: "/main/dashboard/draft" },
      {
        title: "Free Agents",
        icon: Shuffle,
        url: "/main/dashboard/freeagents",
      },
      { title: "Auctions", icon: Shuffle, url: "/main/dashboard/auctions" },
      { title: "Trades", icon: Shuffle, url: "/main/dashboard/trades" },
    ],
  },
];

export function AppSidebar() {
  return (
    <Sidebar className="flex flex-col">
      <div className="flex flex-col gap-4 p-4 border-b border-gray-800  text-white">
        <div className="mt-3 flex flex-col items-center">
          <Combobox />
        </div>
        <div className="flex items-center justify-between px-10">
          <a href="#" className="flex flex-col items-center gap-1">
            <span className="text-sm">Balance</span>
            <Badge variant={"secondary"} className="text-green-600">
              24.5M
            </Badge>
          </a>
          <a href="#" className="flex flex-col items-center gap-1">
            <span className="text-sm">Rank</span>
            <Badge>#3</Badge>
          </a>
        </div>
      </div>
      <SidebarContent className="flex-1  text-white">
        <ScrollArea className="h-full ">
          {sidebarSections.map((section) => (
            <SidebarGroup key={section.section}>
              <SidebarGroupLabel className="text-white text-sm">
                {section.section}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <a
                          href={item.url}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-gray-800 rounded"
                        >
                          <span className="text-neutral-300">{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </ScrollArea>
      </SidebarContent>

      <div className="p-4 border-t border-gray-800  text-white">
        <div className="flex items-center justify-between">
          <a href="#" className="flex items-center gap-1 hover:text-gray-300">
            <Settings className="w-4 h-4" />
            <span className="text-sm">Settings</span>
          </a>
          <a href="#" className="flex items-center gap-1 hover:text-gray-300">
            <Slider className="w-4 h-4" />
            <span className="text-sm">Admin Tools</span>
          </a>
        </div>
        <div className=" flex flex-col items-center align-center">
          <Avatar className="w-8 h-8 rounded-full" />
          <span className="h-8 text-sm font-medium">Joaozooie</span>
        </div>
      </div>
    </Sidebar>
  );
}
