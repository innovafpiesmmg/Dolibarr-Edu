import { useGetStats } from "@workspace/api-client-react";
import { Users, BookOpen, GraduationCap, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Dashboard() {
  const { data: stats, isLoading, isError } = useGetStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium"><Skeleton className="h-4 w-24" /></CardTitle>
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>No se pudieron cargar las estadísticas del panel.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
        <p className="text-muted-foreground">Resumen general del estado de ERP EDU.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Profesores</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats.totalTeachers}</div>
          </CardContent>
        </Card>
        
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Grupos</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats.totalGroups}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Alumnos</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-mono">{stats.totalStudents}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alumnos por Grupo</CardTitle>
            <CardDescription>Distribución actual del alumnado</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.studentsPerGroup.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay grupos registrados.</div>
            ) : (
              <div className="space-y-4">
                {stats.studentsPerGroup.map((group) => (
                  <div key={group.groupId} className="flex items-center">
                    <div className="w-1/3 text-sm font-medium truncate pr-2" title={group.groupName}>
                      {group.groupName}
                    </div>
                    <div className="w-2/3 flex items-center gap-2">
                      <div className="h-2 rounded-full bg-primary/20 flex-1 relative overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-primary" 
                          style={{ width: `${Math.max(5, (group.count / Math.max(...stats.studentsPerGroup.map(g => g.count))) * 100)}%` }} 
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right font-mono">{group.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Estado del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              El entorno Dolibarr está operativo y listo para simulaciones. Todos los servicios de API están funcionando correctamente.
            </p>
            <div className="flex items-center gap-2 text-sm">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="font-medium text-green-700 dark:text-green-400">Sincronización ERP Activa</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
