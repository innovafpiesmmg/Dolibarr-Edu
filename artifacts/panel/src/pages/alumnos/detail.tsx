import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetStudent,
  getGetStudentQueryKey,
  useUpdateStudent,
  useDeployStudent,
  useResetStudentPassword,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, User, Mail, Server, Clock, Rocket, Copy, Check, AlertCircle, RefreshCw, KeyRound, Eye } from "lucide-react";
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

  const deployMutation = useDeployStudent();

  const handleDeploy = () => {
    deployMutation.mutate({ id }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(id) });
        if (result.status === "synced") {
          toast({
            title: "Empresa desplegada en Dolibarr",
            description: `Tercero #${result.entityId} creado correctamente.`,
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
  const canDeploy = !isSynced || isError;
  const dolibarrBaseUrl = (import.meta.env.VITE_DOLIBARR_BASE_URL as string | undefined) ?? "";

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
              {student.dolibarrEntityId && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground bg-muted px-2 py-1.5 rounded">
                  <Server className="h-3.5 w-3.5" />
                  Tercero Dolibarr:
                  <span className="font-mono font-bold text-foreground">#{student.dolibarrEntityId}</span>
                </div>
              )}
            </div>

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
              {dolibarrBaseUrl && isSynced && student.dolibarrEntityId && (
                <a
                  href={`${dolibarrBaseUrl}/societe/card.php?socid=${student.dolibarrEntityId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center text-sm py-2 px-3 border rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Abrir empresa en Dolibarr
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>

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
