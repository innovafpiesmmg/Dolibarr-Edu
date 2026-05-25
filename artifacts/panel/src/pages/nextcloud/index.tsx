import { useState } from "react";
import {
  useGetNextcloudStatus,
  useGetNextcloudUsers,
  useProvisionAllNextcloud,
  getGetNextcloudUsersQueryKey,
  getGetNextcloudStatusQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Cloud, CheckCircle2, AlertCircle, Clock, RefreshCw,
  Users, GraduationCap, Wifi, WifiOff, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useGetSettings } from "@workspace/api-client-react";

function SyncBadge({ status }: { status: string }) {
  if (status === "synced") {
    return (
      <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Activo
      </Badge>
    );
  }
  if (status === "error") {
    return (
      <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-red-500/20 text-xs">
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

export default function NextcloudPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [provisioning, setProvisioning] = useState(false);

  const { data: status, isLoading: statusLoading } = useGetNextcloudStatus({
    query: { queryKey: getGetNextcloudStatusQueryKey() },
  });
  const { data: users, isLoading: usersLoading } = useGetNextcloudUsers({
    query: { queryKey: getGetNextcloudUsersQueryKey() },
  });
  const { data: settings } = useGetSettings();
  const provisionAll = useProvisionAllNextcloud();

  const teachers = users?.teachers ?? [];
  const students = users?.students ?? [];
  const ncUrl = settings?.nextcloudUrl ?? "";

  const pendingTeachers = teachers.filter((t) => t.nextcloudSyncStatus !== "synced").length;
  const pendingStudents = students.filter((s) => s.nextcloudSyncStatus !== "synced").length;
  const totalPending = pendingTeachers + pendingStudents;

  const handleProvisionAll = () => {
    setProvisioning(true);
    provisionAll.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetNextcloudUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetNextcloudStatusQueryKey() });
        setProvisioning(false);
        if (result.errors.length === 0) {
          toast({
            title: "Aprovisionamiento completado",
            description: `${result.provisioned} cuenta(s) creada(s) en Nextcloud.`,
          });
        } else {
          toast({
            variant: "destructive",
            title: `${result.provisioned} creadas, ${result.errors.length} errores`,
            description: result.errors.map((e) => `${e.username}: ${e.error}`).join(" · ").slice(0, 150),
          });
        }
      },
      onError: (err: unknown) => {
        setProvisioning(false);
        const msg = (err as any)?.data?.error ?? "No se pudo conectar con Nextcloud.";
        toast({ variant: "destructive", title: "Error", description: msg });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" /> Nextcloud
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión de cuentas en la nube para profesores y alumnos.
          </p>
        </div>
        <div className="flex gap-2">
          {ncUrl && (
            <Button variant="outline" asChild>
              <a href={ncUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir Nextcloud
              </a>
            </Button>
          )}
          {totalPending > 0 && (
            <Button onClick={handleProvisionAll} disabled={provisioning || !status?.connected}>
              {provisioning ? (
                <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Aprovisionando...</>
              ) : (
                <><Cloud className="mr-2 h-4 w-4" /> Crear cuentas pendientes ({totalPending})</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Estado de conexión */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={status?.connected ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}>
          <CardContent className="pt-6 flex items-center gap-4">
            {statusLoading ? (
              <Skeleton className="h-10 w-10 rounded-full" />
            ) : status?.connected ? (
              <Wifi className="h-10 w-10 text-green-600" />
            ) : (
              <WifiOff className="h-10 w-10 text-red-500" />
            )}
            <div>
              <p className="font-semibold">
                {statusLoading ? "Comprobando..." : status?.connected ? "Conectado" : status?.configured === false ? "Sin configurar" : "Sin conexión"}
              </p>
              <p className="text-xs text-muted-foreground">
                {status?.connected ? `Admin: ${status.adminUser}` : "Verifica NEXTCLOUD_URL y NC_ADMIN_PASSWORD en el servidor"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold font-mono text-green-600">
              {teachers.filter((t) => t.nextcloudSyncStatus === "synced").length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Profesores activos</p>
            <p className="text-xs text-muted-foreground">{pendingTeachers} pendientes</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold font-mono text-blue-600">
              {students.filter((s) => s.nextcloudSyncStatus === "synced").length}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Alumnos activos</p>
            <p className="text-xs text-muted-foreground">{pendingStudents} pendientes</p>
          </CardContent>
        </Card>
      </div>

      {/* Aviso si no configurado */}
      {!statusLoading && !status?.configured && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> Nextcloud no está configurado en el servidor
            </CardTitle>
            <CardDescription className="text-xs">
              Añade las variables <code>NEXTCLOUD_URL</code>, <code>NC_ADMIN_USER</code> y <code>NC_ADMIN_PASSWORD</code> al fichero <code>.env</code> del servidor y reinicia <code>panel_api</code>.
              Configura también la URL pública en <a href="/configuracion" className="underline text-primary">Configuración</a>.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Tablas */}
      <Tabs defaultValue="teachers">
        <TabsList>
          <TabsTrigger value="teachers">
            <Users className="mr-2 h-4 w-4" />
            Profesores
            {pendingTeachers > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{pendingTeachers}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="students">
            <GraduationCap className="mr-2 h-4 w-4" />
            Alumnos
            {pendingStudents > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{pendingStudents}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="teachers">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cuentas de Profesores</CardTitle>
              <CardDescription>5 GB de cuota por cuenta. Cuota compartida de 100 GB total.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Nombre</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : teachers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No hay profesores registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    teachers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="pl-6 font-medium">{t.displayName}</TableCell>
                        <TableCell className="font-mono text-sm">{t.username}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.email}</TableCell>
                        <TableCell><SyncBadge status={t.nextcloudSyncStatus ?? "pending"} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cuentas de Alumnos</CardTitle>
              <CardDescription>5 GB de cuota por cuenta. Cuota compartida de 100 GB total.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Nombre</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No hay alumnos registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="pl-6 font-medium">{s.displayName}</TableCell>
                        <TableCell className="font-mono text-sm">{s.username}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                        <TableCell><SyncBadge status={s.nextcloudSyncStatus ?? "pending"} /></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
