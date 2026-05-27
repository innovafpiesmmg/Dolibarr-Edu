import { useState } from "react";
import {
  useListTeacherMyStudents,
  useListTeacherMyGroups,
  useCreateTeacherMyStudent,
  useDeleteTeacherMyStudent,
  useResetTeacherMyStudentPassword,
  useDeployTeacherMyStudentDolibarr,
  useStartTeacherMyStudentDolibarr,
  useStopTeacherMyStudentDolibarr,
  useDestroyTeacherMyStudentDolibarr,
  getListTeacherMyStudentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, MoreVertical, KeyRound, Play, Square, Rocket, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ProfesorAlumnos() {
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<number | undefined>();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<number | null>(null);
  const [newPasswordInfo, setNewPasswordInfo] = useState<{ name: string; password: string } | null>(null);

  const { data: students, isLoading } = useListTeacherMyStudents({ search, groupId });
  const { data: groups } = useListTeacherMyGroups();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTeacherMyStudentsQueryKey() });

  const createStudent = useCreateTeacherMyStudent({ mutation: { onSuccess: () => { invalidate(); setIsCreateOpen(false); toast({ title: "Alumno creado" }); } } });
  const deleteStudent = useDeleteTeacherMyStudent({ mutation: { onSuccess: () => { invalidate(); setStudentToDelete(null); toast({ title: "Alumno eliminado" }); } } });
  const resetPwd = useResetTeacherMyStudentPassword();
  const deploy = useDeployTeacherMyStudentDolibarr({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Despliegue iniciado" }); } } });
  const startC = useStartTeacherMyStudentDolibarr({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Contenedor iniciado" }); } } });
  const stopC = useStopTeacherMyStudentDolibarr({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Contenedor detenido" }); } } });
  const destroyC = useDestroyTeacherMyStudentDolibarr({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Contenedor eliminado" }); } } });

  // Form state
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", username: "", password: "", groupId: 0, companyName: "" });
  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.groupId) { toast({ variant: "destructive", title: "Selecciona un grupo" }); return; }
    createStudent.mutate({ data: { ...form, companyName: form.companyName || undefined } }, {
      onError: (err: any) => toast({ variant: "destructive", title: "Error al crear", description: err?.data?.error ?? "" }),
    });
  }
  function handleResetPwd(id: number, name: string) {
    resetPwd.mutate({ id }, {
      onSuccess: (data) => setNewPasswordInfo({ name, password: data.newPassword }),
      onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err?.data?.error ?? "" }),
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mis alumnos</h1>
          <p className="text-muted-foreground">Gestiona los alumnos de tus grupos.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nuevo alumno</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear alumno</DialogTitle>
              <DialogDescription>Solo podrás asignarlo a tus grupos.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Nombre</Label><Input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
                <div className="space-y-1"><Label>Apellidos</Label><Input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Usuario</Label><Input required minLength={3} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
                <div className="space-y-1"><Label>Contraseña</Label><Input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              </div>
              <div className="space-y-1">
                <Label>Grupo</Label>
                <Select value={form.groupId ? String(form.groupId) : ""} onValueChange={(v) => setForm({ ...form, groupId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un grupo" /></SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Empresa (opcional)</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
              <DialogFooter>
                <Button type="submit" disabled={createStudent.isPending}>Crear</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre o usuario..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={groupId ? String(groupId) : "all"} onValueChange={(v) => setGroupId(v === "all" ? undefined : Number(v))}>
          <SelectTrigger className="sm:w-64"><SelectValue placeholder="Todos los grupos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los grupos</SelectItem>
            {(groups ?? []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-xl overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Dolibarr</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))
            ) : !students || students.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay alumnos.</TableCell></TableRow>
            ) : (
              students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">{s.firstName} {s.lastName}</div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.username}</TableCell>
                  <TableCell>{s.groupName}</TableCell>
                  <TableCell>
                    <Badge variant={s.dolibarrSyncStatus === "synced" ? "default" : s.dolibarrSyncStatus === "error" ? "destructive" : "secondary"}>
                      {s.dolibarrSyncStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Contenedor</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => deploy.mutate({ id: s.id })}><Rocket className="h-4 w-4 mr-2" />Desplegar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => startC.mutate({ id: s.id })}><Play className="h-4 w-4 mr-2" />Iniciar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => stopC.mutate({ id: s.id })}><Square className="h-4 w-4 mr-2" />Detener</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => destroyC.mutate({ id: s.id })} className="text-destructive"><AlertTriangle className="h-4 w-4 mr-2" />Destruir</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleResetPwd(s.id, `${s.firstName} ${s.lastName}`)}><KeyRound className="h-4 w-4 mr-2" />Resetear contraseña</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setStudentToDelete(s.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" />Eliminar alumno</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={studentToDelete !== null} onOpenChange={(o) => !o && setStudentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar alumno?</DialogTitle>
            <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setStudentToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => studentToDelete && deleteStudent.mutate({ id: studentToDelete })}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!newPasswordInfo} onOpenChange={(o) => !o && setNewPasswordInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva contraseña — {newPasswordInfo?.name}</DialogTitle>
            <DialogDescription>Guarda esta contraseña. No se mostrará otra vez.</DialogDescription>
          </DialogHeader>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm break-all">{newPasswordInfo?.password}</div>
          <DialogFooter>
            <Button onClick={() => setNewPasswordInfo(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
