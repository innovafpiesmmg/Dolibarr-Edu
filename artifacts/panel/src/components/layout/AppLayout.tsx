import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  Upload,
  LogOut,
  Settings,
  ServerCog,
  Activity,
  ExternalLink,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarProvider,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Profesores", href: "/profesores", icon: Users },
  { name: "Grupos", href: "/grupos", icon: BookOpen },
  { name: "Alumnos", href: "/alumnos", icon: GraduationCap },
  { name: "Estado Dolibarr", href: "/estado", icon: ServerCog },
  { name: "Actividad", href: "/actividad", icon: Activity },
  { name: "Importar", href: "/importar", icon: Upload },
  { name: "Configuración", href: "/configuracion", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  const dolibarrUrl = import.meta.env.VITE_DOLIBARR_BASE_URL as string | undefined;

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-sidebar-primary">
          <div
            className="h-7 w-7 bg-sidebar-primary shrink-0"
            style={{
              maskImage: "url('/images/logo.png')",
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskImage: "url('/images/logo.png')",
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
            }}
          />
          <span>ERP EDU</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarMenu>
          {navigation.map((item) => {
            const isActive =
              location === item.href || location.startsWith(item.href + "/");
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                  <Link href={item.href} className="flex items-center gap-3">
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border space-y-3">
        {dolibarrUrl && (
          <a
            href={dolibarrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
            Dolibarr ERP
            <ExternalLink className="h-3 w-3 shrink-0 ml-auto opacity-40" />
          </a>
        )}

        <div className="border-t border-sidebar-border pt-3 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => { logout(); window.location.href = "/"; }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Cerrar sesión
          </Button>
          <div className="text-xs text-sidebar-foreground/40 text-center">
            ERP EDU v1.0
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-border bg-card flex items-center px-6 gap-4 shrink-0">
            <SidebarTrigger />
            <div className="flex-1" />
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <div className="mx-auto max-w-6xl w-full">
              {children}
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
