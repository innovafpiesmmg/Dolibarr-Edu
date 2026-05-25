import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetStudent,
  getGetStudentQueryKey,
  useDeployStudent,
  useResetStudentPassword,
  useGetStudentContainerState,
  getGetStudentContainerStateQueryKey,
  useStartStudentContainer,
  useStopStudentContainer,
  useDestroyStudentContainer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, User, Mail, Server, Clock, Rocket, Copy, Check, AlertCircle, RefreshCw, KeyRound, Eye, Play, Square, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

function SyncStatusBadge({ status, error }: { status: string; error?: string | null }) {
  if (status === "synced") {
    return (
      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 inline-block animate-pulse" />
        Desplegado
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <div className="space-y-1">
        <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
          <AlertCircle className="h-3 w-3 mr-1" />
          Error de sincronización
        </Badge>
        {error && <p className="text-xs text-red-600 dark:text-red-400 max-w-xs truncate">{error}</p>}
      </div>
    );
  }
  return (
    <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/10">
      Pendiente de despliegue
    </Badge>
  );
}

export default function StudentDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [resetResult, setResetResult] = useState<{ newPassword: string; message: string } | null>(null);

  const resetPasswordMutation = useResetStudentPassword();

  const handleResetPassword = () => {
    resetPasswordMutation.mutate({ id }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(id) });
        setResetResult({ newPassword: result.newPassword, message: result.message ?? "" });
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "No se pudo restablecer la contraseña." });
      },
    });
  };

  const { data: student, isLoading } = useGetStudent(id, {
    query: { enabled: !!id, queryKey: getGetStudentQueryKey(id) },
  });

  const { data: containerState, refetch: refetchContainer } = useGetStudentContainerState(id, {
    query: {
      enabled: !!id,
      queryKey: getGetStudentContainerStateQueryKey(id),
      refetchInterval: 8000,
    },
  });

  const deployMutation = useDeployStudent();
  const startMutation = useStartStudentContainer();
  const stopMutation = useStopStudentContainer();
  const destroyMutation = useDestroyStudentContainer();
  const [destroyOpen, setDestroyOpen] = useState(false);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetStudentContainerStateQueryKey(id) });
  };

  const handleStart = () => {
    startMutation.mutate({ id }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Contenedor iniciado" }); },
      onError: (err: unknown) => {
        const msg = (err as any)?.response?.data?.error ?? "No se pudo iniciar el contenedor.";
        toast({ variant: "destructive", title: "Error", description: msg });
      },
    });
  };

  const handleStop = () => {
    stopMutation.mutate({ id }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Contenedor detenido" }); },
      onError: (err: unknown) => {
        const msg = (err as any)?.response?.data?.error ?? "No se pudo detener el contenedor.";
        toast({ variant: "destructive", title: "Error", description: msg });
      },
    });
  };

  const handleDestroy = () => {
    destroyMutation.mutate({ id }, {
      onSuccess: () => {
        invalidateAll();
        setDestroyOpen(false);
        toast({ title: "Contenedor eliminado", description: "Se eliminó el Dolibarr del alumno y su base de datos." });
      },
      onError: (err: unknown) => {
        const msg = (err as any)?.response?.data?.error ?? "No se pudo eliminar el contenedor.";
        toast({ variant: "destructive", title: "Error", description: msg });
      },
    });
  };

  const handleDeploy = () => {
    deployMutation.mutate({ id }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(id) });
        if (result.status === "synced") {
          toast({
            title: "Dolibarr del alumno desplegado",
            description: result.publicUrl
              ? `Disponible en ${result.publicUrl}`
              : `Contenedor ${result.containerName ?? ""} en estado ${result.containerState ?? "running"}.`,
          });
        } else if (result.status === "skipped") {
          toast({ title: "Ya estaba desplegado", description: "Este alumno ya tiene su empresa creada en Dolibarr." });
        } else {
          toast({
            variant: "destructive",
            title: "Error al desplegar",
            description: result.error ?? "Error desconocido",
          });
        }
      },
      onError: (err: unknown) => {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
          ?? "No se pudo conectar con Dolibarr.";
        toast({ variant: "destructive", title: "Error al desplegar", description: message });
      },
    });
  };

  const copyPassword = () => {
    if (student?.dolibarrPassword) {
      void navigator.clipboard.writeText(student.dolibarrPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!student) {
    return <div>Alumno no encontrado</div>;
  }

  const isSynced = student.dolibarrSyncStatus === "synced";
  const isError = student.dolibarrSyncStatus === "error";
  const containerRunning = containerState?.state === "running";
  const containerExists = !!containerState?.exists;
  const publicUrl = containerState?.publicUrl ?? null;

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/alumnos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{student.firstName} {student.lastName}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{student.username}</span>
            <span>en</span>
            <Link href={`/grupos/${student.groupId}`} className="hover:underline text-primary">
              {student.groupName}
            </Link>
          </p>
        </div>
        {isSynced && (
          <Button asChild variant="default" className="gap-2 shrink-0">
            <Link href={`/alumnos/${id}/seguimiento`}>
              <Eye className="h-4 w-4" />
              Seguimiento del alumno
            </Link>
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <CardTitle>Datos Personales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 border-b pb-4">
              <div className="col-span-1 text-sm font-medium text-muted-foreground">Nombre</div>
              <div className="col-span-2 font-medium">{student.firstName}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-b pb-4">
              <div className="col-span-1 text-sm font-medium text-muted-foreground">Apellidos</div>
              <div className="col-span-2 font-medium">{student.lastName}</div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-b pb-4">
              <div className="col-span-1 text-sm font-medium text-muted-foreground">Email</div>
              <div className="col-span-2 flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {student.email}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 border-b pb-4">
              <div className="col-span-1 text-sm font-medium text-muted-foreground">Grupo</div>
              <div className="col-span-2">
                <Badge variant="secondary">{student.groupName}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1 text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Registro
              </div>
              <div className="col-span-2 text-sm">
                {format(new Date(student.createdAt), "d 'de' MMMM, yyyy HH:mm", { locale: es })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center border border-border">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle>Entorno de Simulación</CardTitle>
            </div>
            <div className="flex gap-2">
            <Button
              onClick={handleResetPassword}
              disabled={resetPasswordMutation.isPending}
              size="sm"
              variant="outline"
            >
              {resetPasswordMutation.isPending ? (
                <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Restableciendo...</>
              ) : (
                <><KeyRound className="mr-2 h-3.5 w-3.5" /> Restablecer contraseña</>
              )}
            </Button>
            <Button
              onClick={handleDeploy}
              disabled={deployMutation.isPending || (isSynced && !isError)}
              size="sm"
              variant={isError ? "destructive" : isSynced ? "outline" : "default"}
              className={isSynced && !isError ? "opacity-60" : ""}
            >
              {deployMutation.isPending ? (
                <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Desplegando...</>
              ) : isSynced && !isError ? (
                <><Check className="mr-2 h-3.5 w-3.5" /> Desplegado</>
              ) : isError ? (
                <><RefreshCw className="mr-2 h-3.5 w-3.5" /> Reintentar</>
              ) : (
                <><Rocket className="mr-2 h-3.5 w-3.5" /> Desplegar</>
              )}
            </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="text-sm font-medium text-muted-foreground">Estado en Dolibarr</div>
              <SyncStatusBadge status={student.dolibarrSyncStatus} error={student.dolibarrSyncError} />
            </div>

            <div className="p-4 rounded-lg border bg-card">
              <div className="text-sm font-medium text-muted-foreground mb-1">Nombre de la Empresa</div>
              <div className="text-xl font-bold">{student.companyName || "No especificado"}</div>
              {containerState?.containerName && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground bg-muted px-2 py-1.5 rounded">
                  <Server className="h-3.5 w-3.5" />
                  Contenedor:
                  <span className="font-mono font-bold text-foreground">{containerState.containerName}</span>
                  <Badge
                    variant="outline"
                    className={
                      containerRunning
                        ? "ml-auto text-green-700 dark:text-green-400 border-green-500/30 bg-green-500/10"
                        : containerExists
                        ? "ml-auto text-yellow-700 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
                        : "ml-auto text-muted-foreground"
                    }
                  >
                    {containerState.state}
                  </Badge>
                </div>
              )}
            </div>

            {/* Controles de contenedor */}
            {isSynced && (
              <div className="rounded-lg border p-3 space-y-3 bg-card">
                <div className="text-sm font-medium">Contenedor Docker</div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStart}
                    disabled={startMutation.isPending || containerRunning || !containerExists}
                  >
                    {startMutation.isPending ? (
                      <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Iniciando…</>
                    ) : (
                      <><Play className="mr-2 h-3.5 w-3.5" /> Iniciar</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStop}
                    disabled={stopMutation.isPending || !containerRunning}
                  >
                    {stopMutation.isPending ? (
                      <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Deteniendo…</>
                    ) : (
                      <><Square className="mr-2 h-3.5 w-3.5" /> Detener</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetchContainer()}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refrescar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive ml-auto"
                    onClick={() => setDestroyOpen(true)}
                    disabled={!containerExists}
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar contenedor
                  </Button>
                </div>
                {publicUrl && (
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 text-sm border rounded p-2 bg-background hover:bg-muted/50"
                  >
                    <span className="font-mono text-xs truncate">{publicUrl}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </a>
                )}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Acceso del Alumno</h4>
              <div className="flex justify-between items-center text-sm p-2 border rounded bg-background">
                <span className="text-muted-foreground">Usuario ERP</span>
                <span className="font-mono">{student.username}</span>
              </div>
              {student.dolibarrPassword ? (
                <div className="flex justify-between items-center text-sm p-2 border rounded bg-background">
                  <span className="text-muted-foreground">Contraseña Dolibarr</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{student.dolibarrPassword}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={copyPassword}
                    >
                      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center text-sm p-2 border rounded bg-muted/50">
                  <span className="text-muted-foreground">Contraseña Dolibarr</span>
                  <span className="text-muted-foreground italic text-xs">Se generará al desplegar</span>
                </div>
              )}
              {isSynced && publicUrl && (
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center text-sm py-2 px-3 border rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Abrir Dolibarr del alumno
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

    {/* Destroy container confirmation */}
    <Dialog open={destroyOpen} onOpenChange={setDestroyOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" /> Eliminar contenedor del alumno
          </DialogTitle>
          <DialogDescription>
            Se eliminará el contenedor Docker, su base de datos en MariaDB y los datos asociados.
            El alumno volverá al estado "pendiente de despliegue". <strong>Esta acción no se puede deshacer.</strong>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDestroyOpen(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDestroy} disabled={destroyMutation.isPending}>
            {destroyMutation.isPending ? (
              <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Eliminando…</>
            ) : (
              <><Trash2 className="mr-2 h-4 w-4" /> Eliminar contenedor y BD</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Reset password result dialog */}
    <Dialog open={!!resetResult} onOpenChange={(open) => { if (!open) setResetResult(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contraseña restablecida</DialogTitle>
          <DialogDescription>{resetResult?.message}</DialogDescription>
        </DialogHeader>
        <div className="my-2 p-4 rounded-lg border bg-muted/50 text-center">
          <p className="text-xs text-muted-foreground mb-1">Nueva contraseña</p>
          <p className="font-mono text-xl font-bold tracking-widest">{resetResult?.newPassword}</p>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Anota esta contraseña — no se podrá recuperar después de cerrar este cuadro.
        </p>
        <DialogFooter>
          <Button onClick={() => {
            if (resetResult?.newPassword) {
              void navigator.clipboard.writeText(resetResult.newPassword);
              toast({ title: "Copiado al portapapeles" });
            }
          }} variant="outline" className="w-full sm:w-auto">
            <Copy className="mr-2 h-4 w-4" /> Copiar contraseña
          </Button>
          <Button onClick={() => setResetResult(null)} className="w-full sm:w-auto">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
