import { useState } from "react";
import { useParams, Link } from "wouter";
import { useGetStudent, getGetStudentQueryKey, useGetStudentContainerState, getGetStudentContainerStateQueryKey } from "@workspace/api-client-react";
import {
  ArrowLeft,
  Eye,
  ExternalLink,
  Copy,
  Check,
  KeyRound,
  Building2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  );
}

export default function SeguimientoAlumno() {
  const params = useParams();
  const id = Number(params.id);
  const [credsPanelOpen, setCredsPanelOpen] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeError, setIframeError] = useState(false);

  const { data: student, isLoading } = useGetStudent(id, {
    query: { enabled: !!id, queryKey: getGetStudentQueryKey(id) },
  });
  const { data: containerState } = useGetStudentContainerState(id, {
    query: { enabled: !!id, queryKey: getGetStudentContainerStateQueryKey(id), refetchInterval: 5000 },
  });

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col">
        <div className="h-12 border-b flex items-center px-4 gap-3">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Alumno no encontrado.</p>
      </div>
    );
  }

  const isSynced = student.dolibarrSyncStatus === "synced";
  const entityUrl = containerState?.publicUrl ?? "";
  const containerRunning = containerState?.state === "running";

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ── Barra superior ──────────────────────────────── */}
      <div className="h-14 shrink-0 border-b bg-card flex items-center px-4 gap-3 z-10">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href={`/alumnos/${id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">
              {student.companyName ?? `Empresa de ${student.firstName}`}
            </p>
            <p className="text-xs text-muted-foreground leading-tight truncate">
              {student.firstName} {student.lastName}
            </p>
          </div>
        </div>

        <Badge variant="outline" className="text-xs shrink-0 ml-1">
          <Eye className="h-3 w-3 mr-1" />
          Modo seguimiento
        </Badge>

        <div className="flex-1" />

        {/* Panel de credenciales toggle */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={() => setCredsPanelOpen((v) => !v)}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Credenciales
          {credsPanelOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={() => { setIframeKey((k) => k + 1); setIframeError(false); }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Recargar
        </Button>

        {entityUrl && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 shrink-0" asChild>
            <a href={entityUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              Ventana nueva
            </a>
          </Button>
        )}
      </div>

      {/* ── Panel credenciales (colapsable) ─────────────── */}
      {credsPanelOpen && (
        <div className="shrink-0 border-b bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium w-20">Usuario</span>
              <code className="text-sm font-mono bg-background border border-border px-2 py-0.5 rounded">
                {student.username}
              </code>
              <CopyButton value={student.username} />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium w-20">Contraseña</span>
              {student.dolibarrPassword ? (
                <>
                  <code className="text-sm font-mono bg-background border border-border px-2 py-0.5 rounded">
                    {student.dolibarrPassword}
                  </code>
                  <CopyButton value={student.dolibarrPassword} />
                </>
              ) : (
                <span className="text-xs text-muted-foreground italic">No disponible (alumno no desplegado)</span>
              )}
            </div>

            {entityUrl && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium w-20">URL</span>
                <code className="text-sm font-mono bg-background border border-border px-2 py-0.5 rounded truncate max-w-xs">
                  {entityUrl}
                </code>
                <CopyButton value={entityUrl} />
              </div>
            )}

            <div className="ml-auto flex gap-2">
              {entityUrl && (
                <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" asChild>
                  <a href={entityUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    Abrir en Dolibarr (admin)
                  </a>
                </Button>
              )}
            </div>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Usa estas credenciales para acceder al Dolibarr propio del alumno.
          </p>
        </div>
      )}

      {/* ── Área principal: iframe ───────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {!isSynced ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
            <div>
              <p className="font-semibold">Alumno no desplegado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Este alumno aún no tiene una empresa en Dolibarr. Despliégalo primero desde su ficha.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/alumnos/${id}`}>Ir a la ficha del alumno</Link>
            </Button>
          </div>
        ) : !entityUrl || !containerRunning ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
            <div>
              <p className="font-semibold">Contenedor no disponible</p>
              <p className="text-sm text-muted-foreground mt-1">
                El contenedor Dolibarr del alumno está {containerState?.state ?? "desconocido"}. Inícialo desde la ficha del alumno.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/alumnos/${id}`}>Ir a la ficha del alumno</Link>
            </Button>
          </div>
        ) : iframeError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-8">
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
            <div>
              <p className="font-semibold">No se puede mostrar Dolibarr en el panel</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                El servidor Dolibarr del centro no permite ser embebido en un iframe. Usa las credenciales de arriba
                para acceder directamente o abre la empresa en una ventana nueva.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild>
                <a href={entityUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir en nueva pestaña
                </a>
              </Button>
              <Button variant="outline" onClick={() => { setIframeKey((k) => k + 1); setIframeError(false); }}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reintentar
              </Button>
            </div>
          </div>
        ) : (
          <iframe
            key={iframeKey}
            src={entityUrl}
            className="w-full h-full border-0"
            title={`Empresa de ${student.firstName} ${student.lastName}`}
            allow="fullscreen"
            onError={() => setIframeError(true)}
          />
        )}
      </div>
    </div>
  );
}
