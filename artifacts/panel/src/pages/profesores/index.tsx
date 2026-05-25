import { useState } from "react";
import { Link } from "wouter";
import { useListTeachers, useCreateTeacher, useDeleteTeacher, getListTeachersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Edit, MoreVertical, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio"),
  lastName: z.string().min(1, "Los apellidos son obligatorios"),
  email: z.string().email("Correo electrónico inválido"),
  username: z.string().min(3, "Mínimo 3 caracteres"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  phone: z.string().optional(),
});

export default function ProfesoresList() {
  const [search, setSearch] = useState("");
  const { data: teachers, isLoading } = useListTeachers({ search });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<number | null>(null);

  const createTeacher = useCreateTeacher();
  const deleteTeacher = useDeleteTeacher();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      password: "",
      phone: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createTeacher.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Profesor creado", description: "El profesor ha sido registrado correctamente." });
      },
      onError: (err: unknown) => {
        const msg = (err as any)?.data?.error ?? (err as any)?.message ?? "No se pudo crear el profesor.";
        toast({ variant: "destructive", title: "Error al crear el profesor", description: msg });
      }
    });
  };

  const handleDelete = () => {
    if (!teacherToDelete) return;
    deleteTeacher.mutate({ id: teacherToDelete }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeachersQueryKey() });
        setTeacherToDelete(null);
        toast({ title: "Profesor eliminado", description: "El profesor ha sido eliminado correctamente." });
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el profesor." });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profesores</h1>
          <p className="text-muted-foreground">Gestiona el equipo docente del centro.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="mr-2 h-4 w-4" /> Nuevo Profesor</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Añadir Profesor</DialogTitle>
              <DialogDescription>Registra un nuevo docente. Se le enviará un correo con las credenciales.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                        <FormControl><Input placeholder="Pérez" {...field} /></FormControl>
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
                      <FormControl><Input type="email" placeholder="juan@centro.edu" {...field} /></FormControl>
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
                        <FormControl><Input placeholder="jperez" {...field} /></FormControl>
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
                        <FormControl><Input type="password" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono (Opcional)</FormLabel>
                      <FormControl><Input placeholder="600 000 000" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createTeacher.isPending}>
                    {createTeacher.isPending ? "Guardando..." : "Guardar Profesor"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 bg-card p-4 rounded-lg border border-border shadow-sm">
        <Search className="h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Buscar por nombre, email o usuario..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 focus-visible:ring-0 shadow-none px-0"
        />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Profesor</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead className="text-right">Grupos</TableHead>
              <TableHead className="text-right">Alumnos</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32 mb-1" /><Skeleton className="h-3 w-48" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : teachers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No se encontraron profesores.
                </TableCell>
              </TableRow>
            ) : (
              teachers?.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{teacher.firstName} {teacher.lastName}</div>
                    <div className="text-xs text-muted-foreground">{teacher.email}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{teacher.username}</TableCell>
                  <TableCell className="text-right font-mono">{teacher.groupCount || 0}</TableCell>
                  <TableCell className="text-right font-mono">{teacher.studentCount || 0}</TableCell>
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
                          <Link href={`/profesores/${teacher.id}`} className="cursor-pointer flex items-center w-full">
                            <Edit className="mr-2 h-4 w-4" /> Ver Detalles
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setTeacherToDelete(teacher.id)} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
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

      <Dialog open={teacherToDelete !== null} onOpenChange={(open) => !open && setTeacherToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este profesor? Esta acción no se puede deshacer y desvinculará a los grupos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeacherToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTeacher.isPending}>
              {deleteTeacher.isPending ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
