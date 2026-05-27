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

        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </Button>

        <div className="text-xs text-sidebar-foreground/40 text-center">
          ERP EDU v2.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <TeacherSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 gap-2">
            <SidebarTrigger />
            <div className="text-sm font-medium text-muted-foreground">Panel del profesor</div>
          </header>
          <main className="flex-1 p-6 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
