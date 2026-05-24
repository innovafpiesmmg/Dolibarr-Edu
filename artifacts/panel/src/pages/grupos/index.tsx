import { useState } from "react";
import { Link } from "wouter";
import { 
  useListGroups, 
  useCreateGroup, 
  useDeleteGroup, 
  getListGroupsQueryKey,
  useListTeachers 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Edit, MoreVertical, AlertTriangle, BookOpen, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  name: z.string().min(1, "El nombre del grupo es obligatorio"),
  courseYear: z.string().min(1, "El curso es obligatorio"),
  teacherId: z.coerce.number().min(1, "Debe seleccionar un profesor"),
  description: z.string().optional(),
});

export default function GruposList() {
  const [search, setSearch] = useState("");
  const { data: groups, isLoading } = useListGroups({ search });
  const { data: teachers } = useListTeachers({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<number | null>(null);

  const createGroup = useCreateGroup();
  const deleteGroup = useDeleteGroup();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      courseYear: new Date().getFullYear().toString() + "/" + (new Date().getFullYear() + 1).toString(),
      description: "",
      teacherId: 0,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createGroup.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Grupo creado", description: "El grupo ha sido registrado correctamente." });
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "No se pudo crear el grupo." });
      }
    });
  };

  const handleDelete = () => {
    if (!groupToDelete) return;
    deleteGroup.mutate({ id: groupToDelete }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGroupsQueryKey() });
        setGroupToDelete(null);
        toast({ title: "Grupo eliminado", description: "El grupo ha sido eliminado correctamente." });
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el grupo." });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Grupos</h1>
          <p className="text-muted-foreground">Gestiona las clases y años escolares.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="mr-2 h-4 w-4" /> Nuevo Grupo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Crear Grupo</DialogTitle>
              <DialogDescription>Añade un nuevo grupo y asígnale un profesor responsable.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Grupo</FormLabel>
                      <FormControl><Input placeholder="1º DAW" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="courseYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curso Escolar</FormLabel>
                      <FormControl><Input placeholder="2023/2024" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="teacherId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profesor Responsable</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value ? field.value.toString() : undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un profesor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {teachers?.map((t) => (
                            <SelectItem key={t.id} value={t.id.toString()}>
                              {t.firstName} {t.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (Opcional)</FormLabel>
                      <FormControl><Input placeholder="..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createGroup.isPending}>
                    {createGroup.isPending ? "Guardando..." : "Crear Grupo"}
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
          placeholder="Buscar grupos..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 focus-visible:ring-0 shadow-none px-0"
        />
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Profesor</TableHead>
              <TableHead className="text-right">Alumnos</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : groups?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No se encontraron grupos.
                </TableCell>
              </TableRow>
            ) : (
              groups?.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      {group.name}
                    </div>
                  </TableCell>
                  <TableCell>{group.courseYear}</TableCell>
                  <TableCell>
                    <Link href={`/profesores/${group.teacherId}`} className="hover:underline text-primary">
                      {group.teacherName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono flex items-center justify-end gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    {group.studentCount}
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
                          <Link href={`/grupos/${group.id}`} className="cursor-pointer flex items-center w-full">
                            <Users className="mr-2 h-4 w-4" /> Ver Alumnos
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setGroupToDelete(group.id)} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
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

      <Dialog open={groupToDelete !== null} onOpenChange={(open) => !open && setGroupToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Confirmar Eliminación
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar este grupo? Se desvincularán todos los alumnos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteGroup.isPending}>
              {deleteGroup.isPending ? "Eliminando..." : "Sí, eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
