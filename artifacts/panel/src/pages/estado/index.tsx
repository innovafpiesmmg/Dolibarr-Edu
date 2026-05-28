import { useState } from "react";
import { Link } from "wouter";
import { useListStudents, useDeployStudent, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  ExternalLink,
  ServerCrash,
} from "lucide-react";

type SyncStatus = "synced" | "error" | "pending";

const STATUS_CONFIG: Record<SyncStatus, { label: string; icon: typeof CheckCircle2; color: string }> = {
  synced: { label: "Desplegado", icon: CheckCircle2, color: "text-green-600" },
  error: { label: "Error", icon: AlertCircle, color: "text-red-600" },
  pending: { label: "Pendiente", icon: Clock, color: "text-yellow-600" },
};

function StatusBadge({ status }: { status: string }) {
  const s = (status as SyncStatus) in STATUS_CONFIG ? (status as SyncStatus) : "pending";
  const { label, icon: Icon, color } = STATUS_CONFIG[s];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${color}`}>
      <Icon className="h-4 w-4" />
      {label}
    </span>
  );
}

export default function EstadoSincronizacion() {
  const [filter, setFilter] = useState<"all" | SyncStatus>("all");
  const { data: students, isLoading } = useListStudents({});
  const deployMutation = useDeployStudent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const all = students ?? [];
  const counts = {
    synced: all.filter((s) => s.dolibarrSyncStatus === "synced").length,
    error: all.filter((s) => s.dolibarrSyncStatus === "error").length,
    pending: all.filter((s) => s.dolibarrSyncStatus === "pending").length,
  };
  const displayed =
    filter === "all" ? all : all.filter((s) => s.dolibarrSyncStatus === filter);

  const handleRetry = (id: number, name: string) => {
    deployMutation.mutate({ id }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        if (result.status === "synced") {
          toast({ title: "Desplegado", description: `${name} sincronizado correctamente.` });
        } else if (result.status === "skipped") {
          toast({ title: "Ya estaba desplegado", description: `${name} ya tenía entidad activa.` });
        } else if (result.status === "deploying") {
          toast({ title: "Despliegue iniciado", description: `${name} se está preparando en segundo plano.` });
        } else {
          toast({ variant: "destructive", title: "Error", description: result.error ?? "Error desconocido" });
        }
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "No se pudo conectar con Dolibarr." });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estado de sincronización</h1>
        <p className="text-muted-foreground mt-1">
          Visión global del despliegue de alumnos en Dolibarr.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {(["synced", "error", "pending"] as SyncStatus[]).map((s) => {
          const { label, icon: Icon, color } = STATUS_CONFIG[s];
          return (
            <Card
              key={s}
              className={`cursor-pointer transition-all ${filter === s ? "ring-2 ring-primary" : "hover:border-primary/40"}`}
              onClick={() => setFilter(filter === s ? "all" : s)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`flex items-center gap-2 ${color}`}>
                  <Icon className="h-5 w-5" />
                  <span className="text-3xl font-bold text-foreground">
                    {isLoading ? "—" : counts[s]}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["all", "synced", "error", "pending"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f === "all" ? `Todos (${all.length})` : `${STATUS_CONFIG[f].label} (${counts[f]})`}
          </button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <ServerCrash className="h-8 w-8 opacity-40" />
              <p className="text-sm">No hay alumnos en este estado.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.firstName} {student.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {student.username}
                    </TableCell>
                    <TableCell>
                      <Link href={`/grupos/${student.groupId}`} className="hover:underline text-primary text-sm">
                        {student.groupName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={student.dolibarrSyncStatus ?? "pending"} />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {student.dolibarrSyncError && (
                        <span className="text-xs text-red-600 truncate block max-w-[200px]" title={student.dolibarrSyncError}>
                          {student.dolibarrSyncError}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {student.dolibarrSyncStatus !== "synced" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRetry(student.id, `${student.firstName} ${student.lastName}`)}
                            disabled={deployMutation.isPending}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Reintentar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/alumnos/${student.id}`}>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {counts.error > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">
            Hay <strong>{counts.error}</strong> {counts.error === 1 ? "alumno con error" : "alumnos con error"} de sincronización.
            Pulsa <strong>Reintentar</strong> en cada fila o revisa la configuración de Dolibarr.
          </p>
        </div>
      )}
    </div>
  );
}
