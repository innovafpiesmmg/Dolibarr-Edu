import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  GraduationCap,
  Users2,
  LogOut,
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
import { useTeacherAuth } from "@/contexts/TeacherAuthContext";
import { useGetTeacherMyDolibarr } from "@workspace/api-client-react";

const nav = [
  { name: "Dashboard", href: "/profesor/dashboard", icon: LayoutDashboard },
  { name: "Mis alumnos", href: "/profesor/alumnos", icon: GraduationCap },
  { name: "Equipos", href: "/profesor/equipos", icon: Users2 },
];

function TeacherSidebar() {
  const [location] = useLocation();
  const { teacher, logout } = useTeacherAuth();
  const { data: dolibarr } = useGetTeacherMyDolibarr();

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <SidebarHeader className="h-16 flex items-center justify-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-sidebar-primary">
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
          <span>Profesor</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-4">
        <SidebarMenu>
          {nav.map((item) => {
            const isActive = location === item.href || location.startsWith(item.href + "/");
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
        {dolibarr?.publicUrl && dolibarr?.dolibarrUsername && dolibarr?.dolibarrPassword ? (
          <form
            method="POST"
            action={`${dolibarr.publicUrl.replace(/\/+$/, "")}/index.php?mainmenu=home`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <input type="hidden" name="actionlogin" value="login" />
            <input type="hidden" name="loginfunction" value="loginfunction" />
            <input type="hidden" name="entity" value="1" />
            <input type="hidden" name="username" value={dolibarr.dolibarrUsername} />
            <input type="hidden" name="password" value={dolibarr.dolibarrPassword} />
            <Button type="submit" size="sm" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Acceso a mi Dolibarr
            </Button>
          </form>
        ) : (
          <div className="text-xs text-sidebar-foreground/40 text-center px-1">
            Tu Dolibarr aún no está desplegado. Contacta con el administrador.
          </div>
        )}

        {teacher && (
          <div className="text-xs text-sidebar-foreground/60 text-center truncate">
            {teacher.firstName} {teacher.lastName}
          </div>
        )}

        <div className="text-xs text-sidebar-foreground/40 text-center">
          ERP EDU v2.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  const { logout } = useTeacherAuth();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <TeacherSidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 border-b border-white/10 bg-black text-white flex items-center px-6 gap-4 shrink-0">
            <SidebarTrigger className="text-white hover:bg-white/10 hover:text-white" />
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="text-white/90 hover:bg-white/10 hover:text-white"
              onClick={() => { logout(); window.location.href = "/"; }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            <div className="mx-auto max-w-6xl w-full">
              {children}
            </div>
          </div>
          <footer className="border-t border-white/10 bg-black px-6 py-2.5 shrink-0">
            <div className="mx-auto max-w-6xl w-full flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-white/60">
              <div className="flex items-center gap-1.5">
                <span>© {new Date().getFullYear()}</span>
                <img src="/images/atreyu-logo.png" alt="Atreyu Servicios Digitales" className="h-3.5 w-auto" />
                <span>Atreyu Servicios Digitales</span>
                <span className="opacity-50">·</span>
                <img src="/images/ies-logo.png" alt="IES Manuel Martín González" className="h-3.5 w-auto" />
                <span>IES Manuel Martín González</span>
              </div>
              <span className="opacity-60">ERP EDU v2.0</span>
            </div>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
