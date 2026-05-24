import { useParams } from "wouter";
import { 
  useGetTeacher, 
  getGetTeacherQueryKey, 
  useUpdateTeacher, 
  useListTeacherGroups,
  getGetTeacherQueryOptions
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Edit2, Mail, Phone, BookOpen, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function TeacherDetail() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();

  const { data: teacher, isLoading: isTeacherLoading } = useGetTeacher(id, { query: { enabled: !!id, queryKey: getGetTeacherQueryKey(id) } });
  const { data: groups, isLoading: isGroupsLoading } = useListTeacherGroups(id, { query: { enabled: !!id } });

  if (isTeacherLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return <div>Profesor no encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/profesores"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{teacher.firstName} {teacher.lastName}</h1>
          <p className="text-muted-foreground font-mono">{teacher.username}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle>Información de Contacto</CardTitle>
              <Button variant="ghost" size="icon"><Edit2 className="h-4 w-4" /></Button>
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

        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Grupos Asignados</CardTitle>
            </CardHeader>
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
  );
}
