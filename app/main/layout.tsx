import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full bg-neutral-900 bg-[radial-gradient(#ffffff15_1px,#000000_1px)] bg-[size:20px_20px]">
        <SidebarTrigger />
        {children}
      </main>
    </SidebarProvider>
  );
}
