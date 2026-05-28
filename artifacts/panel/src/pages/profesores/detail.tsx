import { useState } from "react";
import { useParams } from "wouter";
import {
  useGetTeacher,
  getGetTeacherQueryKey,
  useUpdateTeacher,
  useListTeacherGroups,
  getListTeacherGroupsQueryKey,
  useDeployTeacher,
  useGetTeacherContainerState,
  getGetTeacherContainerStateQueryKey,
  useStartTeacherContainer,
  useStopTeacherContainer,
  useDestroyTeacherContainer,
  useEnableTeacherDolibarrModules,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, Edit2, Mail, Phone, BookOpen, Users, Calendar, Save, X,
  Server, Rocket, Play, Square, Trash2, RefreshCw, Puzzle, ExternalLink,
  Copy, Check, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export default function TeacherDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [destroyOpen, setDestroyOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: teacher, isLoading: isTeacherLoading } = useGetTeacher(id, {
    query: { enabled: !!id, queryKey: getGetTeacherQueryKey(id) },
  });
  const { data: groups, isLoading: isGroupsLoading } = useListTeacherGroups(id, {
    query: { enabled: !!id, queryKey: getListTeacherGroupsQueryKey(id) },
  });
  const { data: containerState, refetch: refetchContainer } = useGetTeacherContainerState(id, {
    query: {
      enabled: !!id,
      queryKey: getGetTeacherContainerStateQueryKey(id),
      refetchInterval: 8000,
    },
  });

  const updateTeacher = useUpdateTeacher();
  const deployMutation = useDeployTeacher();
  const startMutation = useStartTeacherContainer();
  const stopMutation = useStopTeacherContainer();
  const destroyMutation = useDestroyTeacherContainer();
  const enableModulesMutation = useEnableTeacherDolibarrModules();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getGetTeacherQueryKey(id) });
    queryClient.invalidateQueries({ queryKey: getGetTeacherContainerStateQueryKey(id) });
  };

  const openEdit = () => {
    if (!teacher) return;
    setEditForm({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      phone: teacher.phone ?? "",
    });
    setEditOpen(true);
  };

  const handleSave = () => {
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || !editForm.email.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Nombre, apellidos y email son obligatorios." });
      return;
    }
    updateTeacher.mutate(
      { id, data: { firstName: editForm.firstName, lastName: editForm.lastName, email: editForm.email, phone: editForm.phone || undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTeacherQueryKey(id) });
          setEditOpen(false);
          toast({ title: "Datos actualizados", description: "La información del profesor se ha guardado correctamente." });
        },
        onError: (err: unknown) => {
          const msg = (err as any)?.data?.error ?? (err as any)?.message ?? "No se pudieron guardar los cambios.";
          toast({ variant: "destructive", title: "Error al guardar", description: msg });
        },
      },
    );
  };

  const handleDeploy = () => {
    deployMutation.mutate({ id }, {
      onSuccess: (r) => {
        invalidateAll();
        if (r.status === "error") {
          toast({ variant: "destructive", title: "Error de despliegue", description: r.error ?? "Falló el despliegue del contenedor." });
        } else if (r.status === "deploying") {
          toast({ title: "Despliegue iniciado", description: "El contenedor se está preparando en segundo plano (puede tardar 1–3 minutos)." });
        } else {
          toast({ title: "Dolibarr desplegado", description: "El contenedor del profesor está en marcha." });
        }
      },
      onError: (err: unknown) => {
        const msg = (err as any)?.data?.error ?? (err as any)?.message ?? "Error de despliegue";
        toast({ variant: "destructive", title: "Error", description: msg });
      },
    });
  };

  const handleStart = () => {
    startMutation.mutate({ id }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Contenedor iniciado" }); },
      onError: () => toast({ variant: "destructive", title: "Error", description: "No se pudo iniciar el contenedor." }),
    });
  };

  const handleStop = () => {
    stopMutation.mutate({ id }, {
      onSuccess: () => { invalidateAll(); toast({ title: "Contenedor detenido" }); },
      onError: () => toast({ variant: "destructive", title: "Error", description: "No se pudo detener el contenedor." }),
    });
  };

  const handleDestroy = () => {
    destroyMutation.mutate({ id }, {
      onSuccess: () => {
        invalidateAll();
        setDestroyOpen(false);
        toast({ title: "Contenedor eliminado", description: "El contenedor y la BD del profesor se han eliminado." });
      },
      onError: () => toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el contenedor." }),
    });
  };

  const handleEnableModules = () => {
    enableModulesMutation.mutate({ id }, {
      onSuccess: (r) => toast({ title: "Módulos activados", description: `${r.enabled.length} módulos activados en el ERP del profesor.` }),
      onError: () => toast({ variant: "destructive", title: "Error", description: "No se pudieron activar los módulos." }),
    });
  };

  const copyPassword = () => {
    if (teacher?.dolibarrPassword) {
      void navigator.clipboard.writeText(teacher.dolibarrPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  if (isTeacherLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4"><Skeleton className="h-48 w-full" /></div>
          <div className="md:col-span-2 space-y-4"><Skeleton className="h-64 w-full" /></div>
        </div>
      </div>
    );
  }

  if (!teacher) return <div>Profesor no encontrado</div>;

  const syncStatus = teacher.dolibarrSyncStatus ?? "pending";
  const isSynced = syncStatus === "synced";
  const containerExists = containerState?.exists ?? false;
  const containerRunning = containerState?.state === "running";
  const publicUrl = containerState?.publicUrl ?? null;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/profesores"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{teacher.firstName} {teacher.lastName}</h1>
            <p className="text-muted-foreground font-mono">{teacher.username}</p>
          </div>
          <div className="ml-auto"><SyncStatusBadge status={syncStatus} error={teacher.dolibarrSyncError} /></div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle>Información de Contacto</CardTitle>
                <Button variant="ghost" size="icon" onClick={openEdit}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{teacher.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{teacher.phone || "No especificado"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Registrado el {format(new Date(teacher.createdAt), "d 'de' MMMM, yyyy", { locale: es })}</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 text-center">
                  <BookOpen className="h-8 w-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">{teacher.groupCount || 0}</div>
                  <div className="text-xs text-muted-foreground">Grupos</div>
                </CardContent>
              </Card>
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 text-primary mx-auto mb-2" />
                  <div className="text-2xl font-bold">{teacher.studentCount || 0}</div>
                  <div className="text-xs text-muted-foreground">Alumnos</div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" /> Dolibarr del profesor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Cada profesor tiene su propio Dolibarr donde actuará como administrador. También servirá de base para los
                  equipos colaborativos: los alumnos del equipo entrarán como usuarios de este mismo ERP.
                </p>

                {!isSynced && (
                  <Button onClick={handleDeploy} disabled={deployMutation.isPending} className="w-full sm:w-auto">
                    {deployMutation.isPending ? (
                      <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Desplegando…</>
                    ) : (
                      <><Rocket className="mr-2 h-4 w-4" /> Desplegar Dolibarr del profesor</>
                    )}
                  </Button>
                )}

                {isSynced && (
                  <>
                    <div className="rounded-lg border p-3 space-y-3 bg-card">
                      <div className="text-sm font-medium">Contenedor Docker</div>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={handleStart}
                          disabled={startMutation.isPending || containerRunning || !containerExists}>
                          {startMutation.isPending ? (
                            <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Iniciando…</>
                          ) : (<><Play className="mr-2 h-3.5 w-3.5" /> Iniciar</>)}
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleStop}
                          disabled={stopMutation.isPending || !containerRunning}>
                          {stopMutation.isPending ? (
                            <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Deteniendo…</>
                          ) : (<><Square className="mr-2 h-3.5 w-3.5" /> Detener</>)}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => refetchContainer()}>
                          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refrescar
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleEnableModules}
                          disabled={enableModulesMutation.isPending || !containerExists}
                          title="Reactiva módulos del ERP del profesor (contabilidad, facturación, nóminas, SS, etc.)">
                          {enableModulesMutation.isPending ? (
                            <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" /> Activando…</>
                          ) : (<><Puzzle className="mr-2 h-3.5 w-3.5" /> Activar módulos</>)}
                        </Button>
                        <Button size="sm" variant="outline"
                          className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive ml-auto"
                          onClick={() => setDestroyOpen(true)} disabled={!containerExists}>
                          <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar contenedor
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Estado:</span>
                        <Badge variant={containerRunning ? "default" : "secondary"} className="font-mono">
                          {containerState?.state ?? "desconocido"}
                        </Badge>
                        {containerState?.containerName && (
                          <span className="font-mono truncate">{containerState.containerName}</span>
                        )}
                      </div>
                      {publicUrl && (
                        <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center justify-between gap-2 text-sm border rounded p-2 bg-background hover:bg-muted/50">
                          <span className="font-mono text-xs truncate">{publicUrl}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </a>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Acceso admin del profesor</h4>
                      <div className="flex justify-between items-center text-sm p-2 border rounded bg-background">
                        <span className="text-muted-foreground">Usuario ERP</span>
                        <span className="font-mono">admin</span>
                      </div>
                      {teacher.dolibarrPassword ? (
                        <div className="flex justify-between items-center text-sm p-2 border rounded bg-background">
                          <span className="text-muted-foreground">Contraseña Dolibarr</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{teacher.dolibarrPassword}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyPassword}>
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
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Grupos Asignados</CardTitle></CardHeader>
              <CardContent>
                {isGroupsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : groups?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
                    Este profesor no tiene grupos asignados.
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {groups?.map((group) => (
                      <Link key={group.id} href={`/grupos/${group.id}`}>
                        <div className="flex items-center justify-between p-4 border rounded-lg hover:border-primary/50 transition-colors bg-card cursor-pointer group">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <BookOpen className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-semibold group-hover:text-primary transition-colors">{group.name}</div>
                              <div className="text-sm text-muted-foreground">{group.courseYear}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary" className="px-3 py-1">
                              <Users className="h-3 w-3 mr-1" /> {group.studentCount}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar profesor</DialogTitle>
            <DialogDescription>Modifica los datos de contacto del profesor.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} placeholder="Juan" />
            </div>
            <div className="space-y-2">
              <Label>Apellidos *</Label>
              <Input value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} placeholder="Pérez" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Correo electrónico *</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="juan@centro.edu" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Teléfono</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="600 000 000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateTeacher.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateTeacher.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={destroyOpen} onOpenChange={setDestroyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Eliminar contenedor del profesor
            </DialogTitle>
            <DialogDescription>
              Se eliminará el contenedor Docker, su base de datos en MariaDB y todos los datos del ERP del profesor.
              <strong> Esta acción no se puede deshacer.</strong>
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
    </>
  );
}
