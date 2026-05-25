import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Users,
  CheckCircle2,
  Upload,
  ExternalLink,
  LogIn,
  BarChart3,
  FileText,
  Banknote,
  Settings,
  CalendarDays,
  ShieldCheck,
  Github,
  FolderKanban,
  FileSpreadsheet,
  Globe,
} from "lucide-react";
import { useStudentLogin } from "@workspace/api-client-react";
import type { AlumnoSesion } from "@workspace/api-client-react";

// ── Student portal ────────────────────────────────────────────────────────────

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
      <Button type="submit" className="w-full h-12" disabled={mutation.isPending}>
        {mutation.isPending ? "Comprobando..." : (
          <>Acceder a mi empresa <LogIn className="ml-2 h-4 w-4" /></>
        )}
      </Button>
    </form>
  );
}

// ── ERP Screenshots tabs ───────────────────────────────────────────────────────

const ERP_TABS = [
  {
    id: "dashboard",
    label: "Panel principal",
    img: "/images/erp/dolibarr-dashboard.jpg",
    caption: "Vista general del ERP con estadísticas, tareas pendientes y gráficos de ventas en tiempo real.",
  },
  {
    id: "empresa",
    label: "Ficha de empresa",
    img: "/images/erp/dolibarr-invoice.png",
    caption: "Cada alumno gestiona su propia empresa: contactos, condiciones comerciales, documentos y más.",
  },
  {
    id: "agenda",
    label: "Agenda y proyectos",
    img: "/images/erp/dolibarr-calendar.jpg",
    caption: "Gestión de eventos, reuniones de equipo e hitos de proyecto con vista mensual y semanal.",
  },
  {
    id: "gastos",
    label: "Contabilidad",
    img: "/images/erp/dolibarr-list.png",
    caption: "Notas de gastos, facturas y conciliaciones contables con flujo completo de aprobación.",
  },
];

function ErpShowcase() {
  const [active, setActive] = useState("dashboard");
  const current = ERP_TABS.find((t) => t.id === active)!;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 justify-center">
        {ERP_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              active === tab.id
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Screenshot */}
      <div className="rounded-xl overflow-hidden border border-border shadow-2xl bg-muted">
        {/* Browser chrome */}
        <div className="bg-muted border-b border-border px-4 py-2.5 flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-red-400/70" />
          <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
          <span className="h-3 w-3 rounded-full bg-green-400/70" />
          <div className="ml-3 flex-1 bg-background/60 rounded px-3 py-0.5 text-xs text-muted-foreground font-mono truncate max-w-xs">
            dolibarr.micentro.es
          </div>
        </div>
        <img
          key={current.id}
          src={current.img}
          alt={current.label}
          className="w-full object-cover object-top"
          style={{ maxHeight: "420px" }}
        />
      </div>

      {/* Caption */}
      <p className="text-center text-sm text-muted-foreground px-4">
        {current.caption}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <BookOpen className="h-6 w-6" />
            <span>ERP EDU</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/innovafpiesmmg/Dolibarr-Edu"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <Button asChild>
              <Link href="/login">
                Panel de gestión <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <main className="pt-16">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden pt-20 pb-16 lg:pt-28 lg:pb-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="mx-auto max-w-7xl px-6 relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12">

              {/* Text */}
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-6">
                  <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
                  La plataforma definitiva para FP
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-foreground">
                  Aprende gestionando <br />
                  <span className="text-primary">empresas reales.</span>
                </h1>
                <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0">
                  ERP EDU proporciona un entorno ERP completo para centros de Formación Profesional.
                  Cada alumno administra su propia empresa simulada con el mismo software que usan las pymes reales.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Button size="lg" className="h-13 px-7 text-base" asChild>
                    <a href="#acceso-alumno">
                      Acceder a mi empresa <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                  <Button size="lg" variant="outline" className="h-13 px-7 text-base" asChild>
                    <a
                      href="https://github.com/innovafpiesmmg/Dolibarr-Edu"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="mr-2 h-4 w-4" />
                      Ver en GitHub
                    </a>
                  </Button>
                </div>

                {/* Stats pills */}
                <div className="flex flex-wrap gap-3 mt-8 justify-center lg:justify-start">
                  {[
                    { label: "Open source", icon: ShieldCheck },
                    { label: "Multiempresa", icon: Building2 },
                    { label: "IGIC / IVA", icon: FileText },
                    { label: "Nóminas integradas", icon: Banknote },
                    { label: "OpenProject", icon: FolderKanban },
                    { label: "LibreOffice Online", icon: FileSpreadsheet },
                  ].map(({ label, icon: Icon }) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Hero screenshot */}
              <div className="flex-1 w-full max-w-2xl lg:max-w-none">
                <div className="rounded-xl overflow-hidden border border-border shadow-2xl">
                  <div className="bg-muted border-b border-border px-4 py-2.5 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-400/70" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
                    <span className="h-3 w-3 rounded-full bg-green-400/70" />
                    <div className="ml-3 flex-1 bg-background/60 rounded px-3 py-0.5 text-xs text-muted-foreground font-mono truncate max-w-xs">
                      dolibarr.micentro.es
                    </div>
                  </div>
                  <img
                    src="/images/erp/dolibarr-dashboard.jpg"
                    alt="Dolibarr ERP — Panel principal"
                    className="w-full object-cover object-top"
                  />
                </div>
                <p className="mt-2 text-xs text-center text-muted-foreground">
                  Captura real del ERP Dolibarr — interfaz que verá cada alumno
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section className="py-20 bg-card border-y border-border">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold mb-2">¿Cómo funciona?</h2>
              <p className="text-muted-foreground">Tres pasos para tener el entorno listo desde el primer día de curso.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "01",
                  title: "Instala el servidor",
                  desc: "Despliega Dolibarr en el servidor del centro con un solo comando. Incluye MariaDB y túnel Cloudflare para acceso seguro sin abrir puertos.",
                  icon: Settings,
                },
                {
                  step: "02",
                  title: "Importa los alumnos",
                  desc: "Sube el CSV del SICE o de tu centro. El panel crea los usuarios, asigna contraseñas y despliega una empresa independiente por alumno en segundos.",
                  icon: Upload,
                },
                {
                  step: "03",
                  title: "Los alumnos empiezan",
                  desc: "Cada estudiante accede desde la landing con sus credenciales y entra directamente en su empresa Dolibarr: facturas, contabilidad, RRHH y más.",
                  icon: Building2,
                },
              ].map(({ step, title, desc, icon: Icon }) => (
                <div key={step} className="relative flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="h-11 w-11 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="w-px flex-1 bg-border mt-3 mb-0 hidden md:block" />
                  </div>
                  <div className="pb-6 md:pb-0">
                    <span className="text-xs font-bold text-primary/60 tracking-widest uppercase">Paso {step}</span>
                    <h3 className="text-base font-bold mt-1 mb-2">{title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ERP en acción ─────────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <Badge variant="outline" className="mb-4 text-primary border-primary/30">
                El ERP real
              </Badge>
              <h2 className="text-3xl font-bold mb-4">
                Así trabajan tus alumnos en Dolibarr
              </h2>
              <p className="text-muted-foreground">
                No es una simulación simplificada. Es Dolibarr ERP/CRM completo, el mismo que usan
                más de 250 000 empresas en todo el mundo.
              </p>
            </div>
            <ErpShowcase />
          </div>
        </section>

        {/* ── Student Portal ────────────────────────────────────────────────── */}
        <section id="acceso-alumno" className="py-24 bg-card border-y border-border">
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
                  Introduce tus credenciales para entrar directamente en el ERP de tu empresa simulada.
                  Tu usuario y contraseña los facilita tu profesor al inicio del curso.
                </p>
                <ul className="space-y-3 text-muted-foreground">
                  {[
                    "Tu empresa es 100 % independiente del resto de alumnos",
                    "Trabaja con un ERP real utilizado por miles de pymes",
                    "Tu progreso queda guardado automáticamente en el servidor",
                    "Accessible desde cualquier dispositivo con navegador",
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

        {/* ── Features grid ─────────────────────────────────────────────────── */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl font-bold mb-4">
                Todo lo necesario para la Formación Profesional
              </h2>
              <p className="text-muted-foreground">
                Un panel diseñado específicamente para coordinadores y profesores que gestionan
                múltiples grupos y cientos de alumnos.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: Building2,
                  title: "1 Alumno = 1 Empresa",
                  desc: "Cada estudiante opera una entidad Dolibarr completamente aislada. Sin interferencias, sin datos compartidos.",
                },
                {
                  icon: Users,
                  title: "Gestión de grupos",
                  desc: "Organiza a los alumnos por curso y asignatura. Asigna profesores responsables a cada grupo con un par de clics.",
                },
                {
                  icon: Upload,
                  title: "Importación masiva",
                  desc: "Sube el CSV del centro al inicio del curso. El sistema crea usuarios, contraseñas y despliega empresas en segundos.",
                },
                {
                  icon: Banknote,
                  title: "Nóminas y Seguridad Social",
                  desc: "Calcula nóminas, genera asientos contables en Dolibarr y registra las liquidaciones de SS e IRPF (Modelo 111).",
                },
                {
                  icon: FileText,
                  title: "IGIC / IVA configurable",
                  desc: "Selecciona el régimen fiscal del centro: IGIC para Canarias o IVA para la Península. Se aplica a todas las entidades nuevas.",
                },
                {
                  icon: BarChart3,
                  title: "Dashboard de estadísticas",
                  desc: "Vista global de profesores, grupos, alumnos activos y despliegues en Dolibarr. Todo en una sola pantalla.",
                },
                {
                  icon: CalendarDays,
                  title: "Agenda y proyectos",
                  desc: "Los alumnos gestionan reuniones, eventos y proyectos con el módulo de agenda integrado en su empresa.",
                },
                {
                  icon: ShieldCheck,
                  title: "Acceso seguro con Cloudflare",
                  desc: "El túnel Cloudflare ofrece HTTPS automático sin necesidad de abrir puertos en el cortafuegos del centro.",
                },
                {
                  icon: Settings,
                  title: "Instalación en un comando",
                  desc: "Script de instalación automático desde GitHub. Dolibarr, MariaDB y el túnel, listos en menos de cinco minutos.",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="bg-card border border-border rounded-xl p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-bold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── ERP modules list ──────────────────────────────────────────────── */}
        <section className="py-20 bg-card border-y border-border">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <Badge variant="outline" className="mb-4 text-primary border-primary/30">
                  Módulos incluidos
                </Badge>
                <h2 className="text-3xl font-bold mb-4">
                  Preparados para el mundo laboral real
                </h2>
                <p className="text-muted-foreground mb-8">
                  Los alumnos trabajan con el mismo ERP que usan las pymes. Desde facturación
                  hasta recursos humanos, todo el ciclo económico de una empresa en un solo software.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    "Facturación de clientes",
                    "Compras y proveedores",
                    "Contabilidad general",
                    "Gestión de inventario",
                    "CRM y contactos",
                    "Proyectos y tareas",
                    "Recursos humanos",
                    "Nóminas y SS",
                    "Banco y tesorería",
                    "Punto de venta",
                    "Informes y estadísticas",
                    "Documentos y ficheros",
                  ].map((mod) => (
                    <div key={mod} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span>{mod}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-border shadow-lg">
                  <div className="bg-muted border-b border-border px-3 py-2 flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                    <span className="ml-2 text-xs text-muted-foreground font-mono">Facturación y CRM</span>
                  </div>
                  <img
                    src="/images/erp/dolibarr-invoice.png"
                    alt="Dolibarr — Ficha de cliente y empresa"
                    className="w-full object-cover object-top"
                    style={{ maxHeight: "200px" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl overflow-hidden border border-border shadow-lg">
                    <div className="bg-muted border-b border-border px-3 py-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-400/70" />
                      <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
                      <span className="h-2 w-2 rounded-full bg-green-400/70" />
                      <span className="ml-1 text-xs text-muted-foreground font-mono truncate">Agenda</span>
                    </div>
                    <img
                      src="/images/erp/dolibarr-calendar.jpg"
                      alt="Dolibarr — Agenda"
                      className="w-full object-cover object-top"
                      style={{ maxHeight: "130px" }}
                    />
                  </div>
                  <div className="rounded-xl overflow-hidden border border-border shadow-lg">
                    <div className="bg-muted border-b border-border px-3 py-2 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-400/70" />
                      <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
                      <span className="h-2 w-2 rounded-full bg-green-400/70" />
                      <span className="ml-1 text-xs text-muted-foreground font-mono truncate">Gastos</span>
                    </div>
                    <img
                      src="/images/erp/dolibarr-list.png"
                      alt="Dolibarr — Gastos"
                      className="w-full object-cover object-top"
                      style={{ maxHeight: "130px" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Ecosistema de herramientas ────────────────────────────────────── */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <Badge variant="outline" className="mb-4 text-primary border-primary/30">
                Ecosistema completo
              </Badge>
              <h2 className="text-3xl font-bold mb-4">
                Tres herramientas, un solo servidor
              </h2>
              <p className="text-muted-foreground">
                ERP EDU integra en el mismo despliegue Docker el ERP, la gestión de proyectos
                y la suite ofimática. Todo accesible desde el centro, sin depender de servicios en la nube.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">

              {/* Dolibarr */}
              <div className="bg-card border border-border rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold">Dolibarr ERP/CRM</h3>
                  <Badge variant="secondary" className="text-xs">ERP</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                  El núcleo del sistema. Cada alumno gestiona su propia empresa con facturación,
                  contabilidad, RRHH, inventario y CRM. Más de 250 000 pymes lo usan en producción.
                </p>
                <ul className="space-y-1.5 text-xs text-muted-foreground mb-6">
                  {["Multiempresa por alumno", "Nóminas y SS integradas", "IGIC / IVA configurable", "Módulo NominasEDU nativo"].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://www.dolibarr.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Globe className="h-3.5 w-3.5" />
                  dolibarr.org
                </a>
              </div>

              {/* OpenProject */}
              <div className="bg-card border border-border rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <FolderKanban className="h-6 w-6 text-primary" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold">OpenProject</h3>
                  <Badge variant="secondary" className="text-xs">Proyectos</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                  Gestión de proyectos al nivel de herramientas profesionales como Jira o Monday.
                  Los alumnos planifican sprints, asignan tareas, registran horas y visualizan el progreso en Gantt.
                </p>
                <ul className="space-y-1.5 text-xs text-muted-foreground mb-6">
                  {["Diagramas de Gantt", "Tableros de tareas", "Registro de horas", "Gestión de miembros y roles"].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://www.openproject.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Globe className="h-3.5 w-3.5" />
                  openproject.org
                </a>
              </div>

              {/* Collabora / LibreOffice */}
              <div className="bg-card border border-border rounded-2xl p-8 shadow-sm hover:shadow-md hover:border-primary/30 transition-all flex flex-col">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold">LibreOffice Online</h3>
                  <Badge variant="secondary" className="text-xs">Ofimática</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                  Suite ofimática completa en el navegador gracias a Collabora Online.
                  Los alumnos crean y editan documentos, hojas de cálculo y presentaciones
                  sin instalar nada, desde cualquier dispositivo.
                </p>
                <ul className="space-y-1.5 text-xs text-muted-foreground mb-6">
                  {["Writer, Calc e Impress", "Edición colaborativa en tiempo real", "Compatible con .docx / .xlsx / .pptx", "Integrado con Dolibarr y OpenProject"].map(f => (
                    <li key={f} className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="https://www.collaboraoffice.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <Globe className="h-3.5 w-3.5" />
                  collaboraoffice.com
                </a>
              </div>

            </div>

            {/* Arquitectura simplificada */}
            <div className="mt-12 bg-card border border-border rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                erp.micentro.es
              </div>
              <span className="text-border">·</span>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <FolderKanban className="h-4 w-4 text-primary" />
                proyectos.micentro.es
              </div>
              <span className="text-border">·</span>
              <div className="flex items-center gap-2 font-medium text-foreground">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                office.micentro.es
              </div>
              <span className="hidden sm:inline text-border">·</span>
              <span className="text-xs">Un único servidor · Cloudflare Tunnel · HTTPS automático</span>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />
          <div className="mx-auto max-w-3xl px-6 relative z-10 text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-6">
              <BookOpen className="h-3.5 w-3.5 mr-2" />
              Empieza hoy
            </div>
            <h2 className="text-4xl font-bold mb-4">
              ¿Listo para transformar tus clases de Administración?
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Accede al panel de gestión y configura el entorno ERP para el próximo curso.
              Gratis, open source y pensado para centros públicos de FP.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="h-14 px-10 text-lg font-bold" asChild>
                <Link href="/login">
                  Acceder al Panel de Gestión <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-10 text-lg" asChild>
                <a
                  href="https://github.com/innovafpiesmmg/Dolibarr-Edu"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-5 w-5" />
                  Ver en GitHub
                </a>
              </Button>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-5">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-primary">
              <BookOpen className="h-4 w-4" />
              ERP EDU
            </div>
            <span className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} Atreyu Servicios Digitales
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground justify-center sm:justify-end">
            <a
              href="https://github.com/innovafpiesmmg/Dolibarr-Edu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
            <span>·</span>
            <a
              href="https://www.dolibarr.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <Building2 className="h-3.5 w-3.5" />
              Dolibarr ERP
            </a>
            <span>·</span>
            <a
              href="https://www.openproject.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              OpenProject
            </a>
            <span>·</span>
            <a
              href="https://www.collaboraoffice.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              LibreOffice Online
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
