import { useState } from "react";
import { Link } from "wouter";
import { 
  useListStudents, 
  useDeleteStudent, 
  getListStudentsQueryKey,
  useListGroups
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Edit, MoreVertical, AlertTriangle, Building2, Upload, FileDown } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function AlumnosList() {
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  
  const { data: students, isLoading } = useListStudents({ search, groupId });
  const { data: groups } = useListGroups({});
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [studentToDelete, setStudentToDelete] = useState<number | null>(null);

  const deleteStudent = useDeleteStudent();

  const handleExportCSV = () => {
    const rows = (students ?? []).map((s) => ({
      Nombre: s.firstName,
      Apellidos: s.lastName,
      Usuario: s.username,
      Email: s.email,
      Grupo: s.groupName,
      Empresa: s.companyName ?? "",
      Estado_Dolibarr: s.dolibarrSyncStatus,
    }));
    downloadCSV(rows, `alumnos-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const handleDelete = () => {
    if (!studentToDelete) return;
    deleteStudent.mutate({ id: studentToDelete }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setStudentToDelete(null);
        toast({ title: "Alumno eliminado", description: "El alumno ha sido eliminado correctamente." });
      },
      onError: (err: unknown) => {
        const msg = (err as any)?.data?.error ?? (err as any)?.message ?? "No se pudo eliminar el alumno.";
        toast({ variant: "destructive", title: "Error al eliminar", description: msg });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Alumnos</h1>
          <p className="text-muted-foreground">Listado global de estudiantes y empresas.</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={!students?.length}>
            <FileDown className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button asChild variant="outline">
            <Link href="/importar"><Upload className="mr-2 h-4 w-4" /> Importación Masiva</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
        <div className="flex-1 flex items-center gap-2">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input 
            placeholder="Buscar por nombre, email o empresa..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 focus-visible:ring-0 shadow-none px-0"
          />
        </div>
        <div className="w-full sm:w-64 shrink-0">
          <Select 
            value={groupId?.toString() || "all"} 
            onValueChange={(v) => setGroupId(v === "all" ? undefined : Number(v))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos los grupos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los grupos</SelectItem>
              {groups?.map(g => (
                <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Alumno</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Empresa Dolibarr</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-48 mb-1" /><Skeleton className="h-3 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : students?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No se encontraron alumnos.
                </TableCell>
              </TableRow>
            ) : (
              students?.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{student.firstName} {student.lastName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{student.username}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal bg-secondary/50">
                      {student.groupName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {student.companyName ? (
                      <div>
                        <div className="font-medium flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                          {student.companyName}
                        </div>
                        <div className="mt-1">
                          {student.dolibarrSyncStatus === "synced" ? (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-green-600 border-green-200 bg-green-50 dark:bg-green-500/10">
                              ✓ Contenedor activo
                            </Badge>
                          ) : student.dolibarrSyncStatus === "error" ? (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-red-600 border-red-200 bg-red-50 dark:bg-red-500/10">
                              ✗ Error sync
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-500/10">
                              Pendiente
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm italic">Sin empresa</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Abrir menú</span>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/alumnos/${student.id}`} className="cursor-pointer flex items-center w-full">
                            <Edit className="mr-2 h-4 w-4" /> Ver Detalles
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setStudentToDelete(student.id)} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={studentToDelete !== null} onOpenChange={(open) => !open && setStudentToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este alumno? Su acceso y empresa en Dolibarr serán desactivados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteStudent.isPending}>
              {deleteStudent.isPending ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
