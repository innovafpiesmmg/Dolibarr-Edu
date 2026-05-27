import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import ProfesoresList from "@/pages/profesores/index";
import TeacherDetail from "@/pages/profesores/detail";
import GruposList from "@/pages/grupos/index";
import GroupDetail from "@/pages/grupos/detail";
import AlumnosList from "@/pages/alumnos/index";
import StudentDetail from "@/pages/alumnos/detail";
import ImportarAlumnos from "@/pages/importar/index";
import Configuracion from "@/pages/configuracion/index";
import EstadoSincronizacion from "@/pages/estado/index";
import Actividad from "@/pages/actividad/index";
import SeguimientoAlumno from "@/pages/alumnos/seguimiento";
import { AppLayout } from "@/components/layout/AppLayout";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        if (error && typeof error === "object" && "status" in error) {
          if ((error as { status: number }).status === 401) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  if (!isAuthenticated) {
    return <Redirect to={`/login?next=${encodeURIComponent(location)}`} />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />

      <Route path="/dashboard">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>

      <Route path="/profesores">
        <ProtectedRoute><ProfesoresList /></ProtectedRoute>
      </Route>
      <Route path="/profesores/:id">
        <ProtectedRoute><TeacherDetail /></ProtectedRoute>
      </Route>

      <Route path="/grupos">
        <ProtectedRoute><GruposList /></ProtectedRoute>
      </Route>
      <Route path="/grupos/:id">
        <ProtectedRoute><GroupDetail /></ProtectedRoute>
      </Route>

      <Route path="/alumnos">
        <ProtectedRoute><AlumnosList /></ProtectedRoute>
      </Route>
      <Route path="/alumnos/:id/seguimiento">
        <ProtectedRoute><SeguimientoAlumno /></ProtectedRoute>
      </Route>
      <Route path="/alumnos/:id">
        <ProtectedRoute><StudentDetail /></ProtectedRoute>
      </Route>

      <Route path="/importar">
        <ProtectedRoute><ImportarAlumnos /></ProtectedRoute>
      </Route>

      <Route path="/configuracion">
        <ProtectedRoute><Configuracion /></ProtectedRoute>
      </Route>

      <Route path="/estado">
        <ProtectedRoute><EstadoSincronizacion /></ProtectedRoute>
      </Route>

      <Route path="/actividad">
        <ProtectedRoute><Actividad /></ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
