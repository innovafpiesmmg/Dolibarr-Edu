import { useParams, Link } from "wouter";
import { 
  useGetGroup, 
  getGetGroupQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Users, Calendar, UserCheck, MoreVertical, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function GroupDetail() {
  const params = useParams();
  const id = Number(params.id);

  const { data: group, isLoading } = useGetGroup(id, { query: { enabled: !!id, queryKey: getGetGroupQueryKey(id) } });

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

  return (
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
          <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Editar</Button>
          <Button asChild><Link href="/importar"><Users className="mr-2 h-4 w-4" /> Añadir Alumnos</Link></Button>
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

        <Card className="md:col-span-3 bg-card border-border">
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
              {group.students?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    No hay alumnos en este grupo. <br/>
                    <Link href="/importar" className="text-primary hover:underline">Importar listado</Link>
                  </TableCell>
                </TableRow>
              ) : (
                group.students?.map((student) => (
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
                      {student.dolibarrEntityId ? (
                        <Badge variant="default" className="bg-green-500/10 text-green-700 hover:bg-green-500/20 border-green-500/20">
                          Desplegado (ID: {student.dolibarrEntityId})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          No desplegado
                        </Badge>
                      )}
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
  );
}
