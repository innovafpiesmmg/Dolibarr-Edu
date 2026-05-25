import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  FileSpreadsheet,
  ExternalLink,
  X,
  Maximize2,
  Loader2,
  ChevronRight,
} from "lucide-react";

interface Tool {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  url: string;
  badge: string;
  features: string[];
}

const tools: Tool[] = [
  {
    id: "projectlibre",
    name: "ProjectLibre",
    description: "Gestión de proyectos con diagramas de Gantt",
    longDescription:
      "Herramienta profesional de gestión de proyectos. Los alumnos pueden planificar tareas, asignar recursos, definir dependencias y visualizar el progreso en diagramas de Gantt, simulando entornos reales de gestión empresarial.",
    icon: FolderKanban,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    url: "https://proyectos.micentro.es",
    badge: "Proyectos",
    features: [
      "Diagramas de Gantt interactivos",
      "Asignación de recursos y horas",
      "Gestión de dependencias entre tareas",
      "Informes de progreso y desviaciones",
      "Exportación a PDF y formatos estándar",
    ],
  },
  {
    id: "collabora",
    name: "Collabora Online",
    description: "Suite ofimática completa en el navegador",
    longDescription:
      "LibreOffice en el navegador. Los alumnos pueden crear y editar documentos de texto, hojas de cálculo y presentaciones sin instalar nada, con la misma calidad que las suites de escritorio profesionales.",
    icon: FileSpreadsheet,
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    url: "https://office.micentro.es",
    badge: "Ofimática",
    features: [
      "Writer — Procesador de textos profesional",
      "Calc — Hojas de cálculo avanzadas",
      "Impress — Presentaciones y diapositivas",
      "Compatible con formatos .docx, .xlsx, .pptx",
      "Edición colaborativa en tiempo real",
    ],
  },
];

function ToolIframe({
  tool,
  onClose,
}: {
  tool: Tool;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Barra superior */}
      <div className="h-12 bg-card border-b border-border flex items-center px-4 gap-3 shrink-0">
        <div className={`flex items-center justify-center h-7 w-7 rounded-md border ${tool.color}`}>
          <tool.icon className="h-4 w-4" />
        </div>
        <span className="font-semibold text-sm">{tool.name}</span>
        <Badge variant="outline" className="text-xs">
          {tool.badge}
        </Badge>
        <div className="flex-1" />
        <a
          href={tool.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mr-2"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir en nueva pestaña
        </a>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* iframe */}
      <div className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background z-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Cargando {tool.name}…</p>
          </div>
        )}
        <iframe
          src={tool.url}
          className="w-full h-full border-0"
          title={tool.name}
          onLoad={() => setLoading(false)}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}

export default function Herramientas() {
  const [openTool, setOpenTool] = useState<Tool | null>(null);

  return (
    <AppLayout>
      {openTool && (
        <ToolIframe tool={openTool} onClose={() => setOpenTool(null)} />
      )}

      <div className="space-y-8">
        {/* Cabecera */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>Panel</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>Herramientas integradas</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Herramientas integradas</h1>
          <p className="text-muted-foreground mt-1">
            Accede a ProjectLibre y Collabora Online directamente desde el panel, sin salir del entorno.
          </p>
        </div>

        {/* Tarjetas de herramientas */}
        <div className="grid md:grid-cols-2 gap-6">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
            >
              {/* Cabecera de la tarjeta */}
              <div className="p-6 pb-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`flex items-center justify-center h-12 w-12 rounded-xl border ${tool.color} shrink-0`}
                  >
                    <tool.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold">{tool.name}</h2>
                      <Badge variant="secondary" className="text-xs">
                        {tool.badge}
                      </Badge>
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                        Integrado
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {tool.longDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* Características */}
              <div className="px-6 pb-5">
                <ul className="space-y-1.5">
                  {tool.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Acciones */}
              <div className="px-6 pb-6 flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => setOpenTool(tool)}
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Abrir en el panel
                </Button>
                <Button variant="outline" asChild>
                  <a href={tool.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Nota informativa */}
        <div className="rounded-xl border border-border bg-muted/40 px-5 py-4 flex items-start gap-3">
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-primary text-xs font-bold">i</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Acceso al servidor del centro.</span>{" "}
            Estas herramientas se ejecutan en el servidor del centro. Si no puedes acceder,
            comprueba que el servidor está encendido y los servicios Docker están activos.
            El administrador puede verificarlo con{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
              docker compose ps
            </code>.
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
