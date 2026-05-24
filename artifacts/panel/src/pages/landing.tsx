import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Users,
  CheckCircle2,
  Upload,
  ExternalLink,
  LogIn,
} from "lucide-react";
import { useStudentLogin } from "@workspace/api-client-react";
import type { AlumnoSesion } from "@workspace/api-client-react";

function StudentPortal() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState<AlumnoSesion | null>(null);

  const mutation = useStudentLogin({
    mutation: {
      onSuccess(data) {
        setSession(data);
        setError("");
      },
      onError() {
        setError("Usuario o contraseña incorrectos.");
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSession(null);
    mutation.mutate({ data: { username, password } });
  }

  if (session) {
    return (
      <div className="bg-card border border-primary/20 rounded-2xl p-8 text-center shadow-lg max-w-sm w-full mx-auto">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground mb-1">Bienvenido,</p>
        <h3 className="text-xl font-bold mb-1">
          {session.firstName} {session.lastName}
        </h3>
        {session.companyName && (
          <p className="text-primary font-medium mb-1">{session.companyName}</p>
        )}
        <p className="text-sm text-muted-foreground mb-6">Grupo: {session.groupName}</p>

        {session.dolibarrUrl ? (
          <Button asChild className="w-full h-12 text-base font-semibold">
            <a href={session.dolibarrUrl} target="_blank" rel="noopener noreferrer">
              Acceder a mi empresa <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            La URL de Dolibarr aún no está configurada. Consulta con tu profesor.
          </p>
        )}

        <button
          onClick={() => { setSession(null); setUsername(""); setPassword(""); }}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Usar otra cuenta
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm w-full mx-auto">
      <div className="space-y-2">
        <Label htmlFor="student-username" className="text-foreground/80">Usuario</Label>
        <Input
          id="student-username"
          placeholder="nombre.apellido"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="student-password" className="text-foreground/80">Contraseña</Label>
        <Input
          id="student-password"
          type="password"
          placeholder="Tu contraseña ERP"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        className="w-full h-12"
        disabled={mutation.isPending}
      >
        {mutation.isPending ? "Comprobando..." : (
          <>Acceder a mi empresa <LogIn className="ml-2 h-4 w-4" /></>
        )}
      </Button>
    </form>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <BookOpen className="h-6 w-6" />
            <span>Dolibarr EDU</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" className="hidden md:flex">Soporte</Button>
            <Button asChild>
              <Link href="/login">
                Acceder al Panel <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="mx-auto max-w-7xl px-6 relative z-10 flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-6">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
                La plataforma definitiva para FP
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold tracking-tight mb-6 text-foreground font-sans">
                Aprende gestionando <br/>
                <span className="text-primary">empresas reales.</span>
              </h1>
              <p className="text-lg lg:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto lg:mx-0">
                Dolibarr EDU proporciona un entorno ERP completo para centros de Formación Profesional. Cada alumno administra su propia empresa simulada, guiado por sus profesores.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button size="lg" className="h-14 px-8 text-lg" asChild>
                  <a href="#acceso-alumno">
                    Acceder a mi empresa <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg">
                  Ver documentación
                </Button>
              </div>
            </div>
            <div className="flex-1 relative w-full max-w-xl lg:max-w-none">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-border/50 shadow-2xl relative">
                <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
                <img
                  src="/images/classroom.jpg"
                  alt="Students in a modern vocational training classroom"
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-card border border-border shadow-xl rounded-xl p-6 hidden md:block">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">Estudiantes Activos</p>
                    <p className="text-2xl font-bold font-mono">1,240+</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Student Portal Section */}
        <section id="acceso-alumno" className="py-24 bg-card">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-4">
                  <Building2 className="h-3.5 w-3.5 mr-2" />
                  Portal del Alumno
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                  Accede a tu empresa
                </h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Introduce tus credenciales para entrar directamente en el ERP de tu empresa simulada. Tu usuario y contraseña los facilita tu profesor al inicio del curso.
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  {[
                    "Tu empresa es 100% independiente del resto",
                    "Trabaja con un ERP real utilizado por empresas",
                    "Tu progreso queda guardado automáticamente",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center">
                <div className="bg-background border border-border rounded-2xl p-8 shadow-sm w-full max-w-sm">
                  <h3 className="text-lg font-bold mb-6 text-center">Iniciar sesión</h3>
                  <StudentPortal />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold mb-4">Todo lo necesario para la Formación Profesional</h2>
              <p className="text-muted-foreground">Un panel de control diseñado específicamente para coordinadores y profesores que necesitan gestionar múltiples grupos y cientos de alumnos.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: Building2,
                  title: "1 Alumno = 1 Empresa",
                  desc: "Automatiza la creación de entidades aisladas en Dolibarr para que cada estudiante opere su propia empresa simulada sin interferencias."
                },
                {
                  icon: Users,
                  title: "Gestión de Grupos",
                  desc: "Organiza a los alumnos por años y asignaturas. Asigna profesores responsables a cada grupo con un par de clics."
                },
                {
                  icon: Upload,
                  title: "Importación Masiva",
                  desc: "Sube listas de alumnos mediante CSV al inicio del curso. El sistema crea los usuarios, asigna contraseñas y despliega las empresas en segundos."
                }
              ].map((feature, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-8 shadow-sm hover:shadow-md transition-shadow">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Image Section */}
        <section className="py-24 relative overflow-hidden bg-card">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="aspect-square rounded-full absolute -top-12 -left-12 w-64 bg-primary/5 blur-3xl" />
                <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-border shadow-xl">
                  <img
                    src="/images/collaboration.jpg"
                    alt="Students collaborating"
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
              <div className="order-1 lg:order-2">
                <h2 className="text-3xl lg:text-4xl font-bold mb-6">Preparados para el mundo laboral real</h2>
                <p className="text-lg text-muted-foreground mb-8">
                  El salto de la teoría a la práctica es el mayor desafío en la formación profesional. Con Dolibarr EDU, los alumnos se enfrentan a la interfaz real de un ERP líder en el mercado.
                </p>
                <ul className="space-y-4 mb-8">
                  {[
                    "Facturación y contabilidad real",
                    "Gestión de inventario y almacenes",
                    "CRM y relaciones con clientes",
                    "Recursos humanos y nóminas"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0">
            <img src="/images/building.jpg" alt="Campus" className="w-full h-full object-cover brightness-50" />
            <div className="absolute inset-0 bg-sidebar/90 mix-blend-multiply" />
          </div>
          <div className="mx-auto max-w-4xl px-6 relative z-10 text-center text-sidebar-foreground">
            <h2 className="text-4xl font-bold mb-6 text-white">¿Listo para transformar tus clases?</h2>
            <p className="text-xl text-white/80 mb-10">
              Accede al panel de administración y comienza a configurar el entorno para el próximo curso.
            </p>
            <Button size="lg" className="h-16 px-10 text-lg font-bold" asChild>
              <Link href="/login">
                Acceder al Panel de Gestión
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="bg-card border-t border-border py-4">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <img src="/images/asd-logo.png" alt="ASD" className="h-7 w-auto" />
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Atreyu Servicios Digitales. Todos los derechos reservados.
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Basado en{" "}
            <a
              href="https://www.dolibarr.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Dolibarr ERP/CRM
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
