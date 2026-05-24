import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import ProfesoresList from "@/pages/profesores/index";
import TeacherDetail from "@/pages/profesores/detail";
import GruposList from "@/pages/grupos/index";
import GroupDetail from "@/pages/grupos/detail";
import AlumnosList from "@/pages/alumnos/index";
import StudentDetail from "@/pages/alumnos/detail";
import ImportarAlumnos from "@/pages/importar/index";
import { AppLayout } from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/dashboard">
        <AdminLayout><Dashboard /></AdminLayout>
      </Route>
      
      {/* Profesores */}
      <Route path="/profesores">
        <AdminLayout><ProfesoresList /></AdminLayout>
      </Route>
      <Route path="/profesores/:id">
        <AdminLayout><TeacherDetail /></AdminLayout>
      </Route>

      {/* Grupos */}
      <Route path="/grupos">
        <AdminLayout><GruposList /></AdminLayout>
      </Route>
      <Route path="/grupos/:id">
        <AdminLayout><GroupDetail /></AdminLayout>
      </Route>

      {/* Alumnos */}
      <Route path="/alumnos">
        <AdminLayout><AlumnosList /></AdminLayout>
      </Route>
      <Route path="/alumnos/:id">
        <AdminLayout><StudentDetail /></AdminLayout>
      </Route>

      {/* Importar */}
      <Route path="/importar">
        <AdminLayout><ImportarAlumnos /></AdminLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
