import { useParams, Link } from "wouter";
import { 
  useGetStudent, 
  getGetStudentQueryKey,
  useUpdateStudent
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, User, Mail, Server, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function StudentDetail() {
  const params = useParams();
  const id = Number(params.id);

  const { data: student, isLoading } = useGetStudent(id, { query: { enabled: !!id, queryKey: getGetStudentQueryKey(id) } });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/alumnos"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{student.firstName} {student.lastName}</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">{student.username}</span>
            <span>en</span>
            <Link href={`/grupos/${student.groupId}`} className="hover:underline text-primary">
              {student.groupName}
            </Link>
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Datos Personales</CardTitle>
            </div>
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
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center border border-border">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Entorno de Simulación</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 rounded-lg border bg-card relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                {student.dolibarrEntityId ? (
                  <div className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                ) : (
                  <div className="flex h-2 w-2 rounded-full bg-yellow-500" />
                )}
              </div>
              <div className="text-sm font-medium text-muted-foreground mb-1">Nombre de la Empresa</div>
              <div className="text-xl font-bold mb-4">{student.companyName || "No especificado"}</div>
              
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
                <Server className="h-4 w-4" />
                Entity ID Dolibarr: 
                <span className="font-mono font-bold text-foreground">
                  {student.dolibarrEntityId || "N/A"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Accesos del Alumno</h4>
              <div className="grid gap-2">
                <div className="flex justify-between items-center text-sm p-2 border rounded bg-background">
                  <span className="text-muted-foreground">URL Dolibarr</span>
                  <a href="#" className="text-primary hover:underline font-mono">erp.educa.net/edu</a>
                </div>
                <div className="flex justify-between items-center text-sm p-2 border rounded bg-background">
                  <span className="text-muted-foreground">Usuario ERP</span>
                  <span className="font-mono">{student.username}</span>
                </div>
              </div>
            </div>

            {!student.dolibarrEntityId && (
              <div className="p-3 text-sm bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20 rounded-md">
                La entidad en Dolibarr aún no se ha creado. Esto suele ocurrir automáticamente mediante un proceso en segundo plano.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
