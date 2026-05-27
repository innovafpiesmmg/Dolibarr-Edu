import { useGetTeacherMe, useGetTeacherMyStats, useListTeacherMyGroups } from "@workspace/api-client-react";
import { GraduationCap, BookOpen, ServerCog, Users2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}

export default function ProfesorDashboard() {
  const { data: me } = useGetTeacherMe();
  const { data: stats, isLoading } = useGetTeacherMyStats();
  const { data: groups } = useListTeacherMyGroups();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bienvenido{me ? `, ${me.firstName}` : ""}
        </h1>
        <p className="text-muted-foreground">Resumen de tus grupos y alumnos.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading || !stats ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard label="Mis grupos" value={stats.groupCount} icon={BookOpen} />
            <StatCard label="Mis alumnos" value={stats.studentCount} icon={GraduationCap} />
            <StatCard label="Contenedores activos" value={stats.activeContainers} icon={ServerCog} />
            <StatCard label="Equipos" value={stats.teamCount} icon={Users2} />
          </>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="font-semibold mb-3">Mis grupos</h2>
        {!groups || groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes grupos asignados.</p>
        ) : (
          <ul className="space-y-2">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                <span className="font-medium">{g.name}</span>
                <span className="text-muted-foreground">{g.studentCount} alumnos</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
