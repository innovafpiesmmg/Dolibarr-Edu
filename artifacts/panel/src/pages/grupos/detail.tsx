import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetGroup,
  getGetGroupQueryKey,
  useDeployGroupStudents,
  useUpdateGroup,
  useListTeachers,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, BookOpen, Users, UserCheck, MoreVertical, Edit,
  Rocket, RefreshCw, CheckCircle2, AlertCircle, Clock, Save, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function SyncBadge({ status }: { status: string }) {
  if (status === "synced") {
    return (
      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 hover:bg-green-500/20 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Desplegado
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20 text-xs">
        <AlertCircle className="h-3 w-3 mr-1" /> Error
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 border-yellow-400/40 bg-yellow-500/10 text-xs">
      <Clock className="h-3 w-3 mr-1" /> Pendiente
    </Badge>
  );
}

export default function GroupDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDeployDialog, setShowDeployDialog] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", courseYear: "", description: "", teacherId: 0 });

  const { data: group, isLoading } = useGetGroup(id, {
    query: { enabled: !!id, queryKey: getGetGroupQueryKey(id) },
  });
  const { data: teachers } = useListTeachers({});

  const deployAll = useDeployGroupStudents();
  const updateGroup = useUpdateGroup();

  const openEdit = () => {
    if (!group) return;
    setEditForm({
      name: group.name,
      courseYear: group.courseYear,
      description: group.description ?? "",
      teacherId: group.teacherId,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editForm.name.trim() || !editForm.courseYear.trim()) {
      toast({ variant: "destructive", title: "Error", description: "El nombre y el curso son obligatorios." });
      return;
    }
    updateGroup.mutate(
      {
        id,
        data: {
          name: editForm.name,
          courseYear: editForm.courseYear,
          description: editForm.description || undefined,
          teacherId: editForm.teacherId || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(id) });
          setEditOpen(false);
          toast({ title: "Grupo actualizado", description: "Los datos del grupo se han guardado correctamente." });
        },
        onError: (err: unknown) => {
          const msg = (err as any)?.data?.error ?? (err as any)?.message ?? "No se pudieron guardar los cambios.";
          toast({ variant: "destructive", title: "Error al guardar", description: msg });
        },
      },
    );
  };

  const handleDeployAll = () => {
    deployAll.mutate({ id }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetGroupQueryKey(id) });
        setShowDeployDialog(false);
        if (result.errors.length === 0) {
          toast({
            title: "Despliegue completado",
            description: `${result.deployed} empresa(s) desplegada(s). ${result.skipped} ya estaban activas.`,
          });
        } else {
          toast({
            variant: "destructive",
            title: `${result.deployed} desplegados, ${result.errors.length} errores`,
            description: result.errors.map((e) => `${e.username}: ${e.error}`).join(" · ").slice(0, 120),
          });
        }
      },
      onError: (err: unknown) => {
        setShowDeployDialog(false);
        const msg = (err as any)?.data?.error ?? "No se pudo conectar con Dolibarr.";
        toast({ variant: "destructive", title: "Error al desplegar", description: msg });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-4 gap-6">
          <Skeleton className="h-32 w-full md:col-span-1" />
          <Skeleton className="h-32 w-full md:col-span-3" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!group) {
    return <div>Grupo no encontrado</div>;
  }

  const students = group.students ?? [];
  const syncedCount = students.filter((s) => s.dolibarrSyncStatus === "synced").length;
  const pendingCount = students.filter((s) => s.dolibarrSyncStatus !== "synced").length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/grupos"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-3xl font-bold tracking-tight">{group.name}</h1>
              </div>
              <p className="text-muted-foreground">{group.courseYear}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit}>
              <Edit className="mr-2 h-4 w-4" /> Editar
            </Button>
            {pendingCount > 0 && (
              <Button
                onClick={() => setShowDeployDialog(true)}
                disabled={deployAll.isPending}
                variant="default"
              >
                {deployAll.isPending ? (
                  <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Desplegando...</>
                ) : (
                  <><Rocket className="mr-2 h-4 w-4" /> Desplegar grupo ({pendingCount})</>
                )}
              </Button>
            )}
            <Button asChild variant={pendingCount > 0 ? "outline" : "default"}>
              <Link href="/importar"><Users className="mr-2 h-4 w-4" /> Añadir Alumnos</Link>
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6">
          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Profesor Responsable</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <Link href={`/profesores/${group.teacherId}`} className="font-medium hover:underline hover:text-primary transition-colors">
                    {group.teacherName}
                  </Link>
                  <div className="text-xs text-muted-foreground">Coordinador</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 bg-card border-border">
            <CardContent className="p-6 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Descripción</div>
                <p>{group.description || "Sin descripción"}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-muted-foreground mb-1">Total Alumnos</div>
                <div className="text-3xl font-bold font-mono">{group.studentCount}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sync Dolibarr</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Desplegados
                </span>
                <span className="font-bold font-mono">{syncedCount}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
                  <Clock className="h-3.5 w-3.5" /> Pendientes
                </span>
                <span className="font-bold font-mono">{pendingCount}</span>
              </div>
              {students.length > 0 && (
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(syncedCount / students.length) * 100}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado de Alumnos y Empresas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Alumno</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Empresa Asignada</TableHead>
                  <TableHead>Estado Dolibarr</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      No hay alumnos en este grupo. <br />
                      <Link href="/importar" className="text-primary hover:underline">Importar listado</Link>
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="pl-6">
                        <div className="font-medium text-foreground">{student.firstName} {student.lastName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{student.username}</div>
                      </TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>
                        {student.companyName ? (
                          <span className="font-medium">{student.companyName}</span>
                        ) : (
                          <span className="text-muted-foreground italic text-sm">Pendiente de creación</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <SyncBadge status={student.dolibarrSyncStatus ?? "pending"} />
                          {student.dolibarrEntityId && (
                            <div className="text-xs text-muted-foreground font-mono">ID: {student.dolibarrEntityId}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/alumnos/${student.id}`}><MoreVertical className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Deploy dialog */}
      <Dialog open={showDeployDialog} onOpenChange={setShowDeployDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Desplegar grupo en Dolibarr
            </DialogTitle>
            <DialogDescription>
              Se crearán las empresas y usuarios en Dolibarr para los {pendingCount} alumno(s) pendientes del grupo <strong>{group.name}</strong>. Los {syncedCount} ya desplegados no se modificarán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeployDialog(false)}>Cancelar</Button>
            <Button onClick={handleDeployAll} disabled={deployAll.isPending}>
              {deployAll.isPending ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Desplegando...</>
              ) : (
                <><Rocket className="mr-2 h-4 w-4" /> Desplegar {pendingCount} alumno(s)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar grupo</DialogTitle>
            <DialogDescription>Modifica el nombre, curso, descripción o profesor del grupo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="1º DAW"
                />
              </div>
              <div className="space-y-2">
                <Label>Curso escolar *</Label>
                <Input
                  value={editForm.courseYear}
                  onChange={(e) => setEditForm({ ...editForm, courseYear: e.target.value })}
                  placeholder="2024/2025"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Descripción opcional"
              />
            </div>
            <div className="space-y-2">
              <Label>Profesor responsable</Label>
              <Select
                value={editForm.teacherId ? editForm.teacherId.toString() : ""}
                onValueChange={(v) => setEditForm({ ...editForm, teacherId: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar profesor" />
                </SelectTrigger>
                <SelectContent>
                  {teachers?.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateGroup.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateGroup.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
