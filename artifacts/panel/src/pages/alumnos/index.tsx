import { useState } from "react";
import { Link } from "wouter";
import {
  useListStudents,
  useCreateStudent,
  useDeleteStudent,
  getListStudentsQueryKey,
  useListGroups,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Edit, MoreVertical, AlertTriangle, Building2, Upload, FileDown } from "lucide-react";
import { downloadCSV } from "@/lib/export-csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const createSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().min(1, "Los apellidos son obligatorios"),
  email: z.string().email("Correo electrónico inválido"),
  username: z.string().min(3, "Mínimo 3 caracteres"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  groupId: z.coerce.number({ invalid_type_error: "Selecciona un grupo" }).int().positive("Selecciona un grupo"),
  companyName: z.string().optional(),
});

export default function AlumnosList() {
  const [search, setSearch] = useState("");
  const [groupId, setGroupId] = useState<number | undefined>(undefined);
  
  const { data: students, isLoading } = useListStudents({ search, groupId });
  const { data: groups, isLoading: isLoadingGroups } = useListGroups({});
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [studentToDelete, setStudentToDelete] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const createStudent = useCreateStudent();
  const deleteStudent = useDeleteStudent();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      password: "",
      groupId: undefined as unknown as number,
      companyName: "",
    },
  });

  const onCreate = (values: z.infer<typeof createSchema>) => {
    const payload = {
      ...values,
      companyName: values.companyName?.trim() ? values.companyName.trim() : undefined,
    };
    createStudent.mutate(
      { data: payload },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
          setIsCreateOpen(false);
          form.reset();
          toast({ title: "Alumno creado", description: "El alumno ha sido registrado correctamente." });
        },
        onError: (err: unknown) => {
          const msg = (err as any)?.data?.error ?? (err as any)?.message ?? "No se pudo crear el alumno.";
          toast({ variant: "destructive", title: "Error al crear el alumno", description: msg });
        },
      },
    );
  };

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
        
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleExportCSV} disabled={!students?.length}>
            <FileDown className="mr-2 h-4 w-4" /> Exportar CSV
          </Button>
          <Button asChild variant="outline">
            <Link href="/importar"><Upload className="mr-2 h-4 w-4" /> Importación Masiva</Link>
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) form.reset(); }}>
            <DialogTrigger asChild>
              <Button className="shrink-0"><Plus className="mr-2 h-4 w-4" /> Nuevo Alumno</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Añadir Alumno</DialogTitle>
                <DialogDescription>
                  Registra un nuevo alumno. Tras crearlo podrás desplegar su Dolibarr desde la ficha.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl><Input placeholder="Juan" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellidos</FormLabel>
                          <FormControl><Input placeholder="Pérez García" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico</FormLabel>
                        <FormControl><Input type="email" placeholder="juan.perez@centro.edu" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Usuario</FormLabel>
                          <FormControl><Input placeholder="juanperez" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contraseña</FormLabel>
                          <FormControl><Input type="password" placeholder="Mínimo 6 caracteres" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="groupId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo</FormLabel>
                        <Select
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) => field.onChange(Number(v))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un grupo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingGroups ? (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">Cargando grupos…</div>
                            ) : groups?.length ? (
                              groups.map((g) => (
                                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                              ))
                            ) : (
                              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                No hay grupos. Crea uno primero en Grupos.
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Empresa simulada (opcional)</FormLabel>
                        <FormControl><Input placeholder="Ej. JuanPérez S.L." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={createStudent.isPending || !groups?.length}>
                      {createStudent.isPending ? "Guardando..." : "Guardar Alumno"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
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
                          ) : student.dolibarrSyncStatus === "deploying" ? (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-500/10">
                              Desplegando…
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
