import { useState } from "react";
import { useListActivity } from "@workspace/api-client-react";
import type { ActivityEntry } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  UserPlus,
  UserMinus,
  KeyRound,
  Rocket,
  FileText,
  Banknote,
  Settings,
  Activity,
  Users,
  BookOpen,
  GraduationCap,
} from "lucide-react";

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  create_student:    { label: "Alumno creado",        icon: UserPlus,     color: "bg-green-500/10 text-green-700" },
  update_student:    { label: "Alumno actualizado",   icon: GraduationCap,color: "bg-blue-500/10 text-blue-700" },
  delete_student:    { label: "Alumno eliminado",     icon: UserMinus,    color: "bg-red-500/10 text-red-700" },
  deploy_student:    { label: "Empresa desplegada",   icon: Rocket,       color: "bg-purple-500/10 text-purple-700" },
  reset_password:    { label: "Contraseña restablecida", icon: KeyRound,  color: "bg-yellow-500/10 text-yellow-700" },
  create_teacher:    { label: "Profesor creado",      icon: UserPlus,     color: "bg-green-500/10 text-green-700" },
  delete_teacher:    { label: "Profesor eliminado",   icon: UserMinus,    color: "bg-red-500/10 text-red-700" },
  create_group:      { label: "Grupo creado",         icon: BookOpen,     color: "bg-green-500/10 text-green-700" },
  delete_group:      { label: "Grupo eliminado",      icon: UserMinus,    color: "bg-red-500/10 text-red-700" },
  create_payroll:    { label: "Nómina generada",      icon: Banknote,     color: "bg-indigo-500/10 text-indigo-700" },
  delete_payroll:    { label: "Nómina eliminada",     icon: Banknote,     color: "bg-red-500/10 text-red-700" },
  bulk_import:       { label: "Importación masiva",   icon: Users,        color: "bg-cyan-500/10 text-cyan-700" },
  update_settings:   { label: "Configuración cambiada", icon: Settings,   color: "bg-orange-500/10 text-orange-700" },
};

const ENTITY_FILTERS = [
  { value: "", label: "Todo" },
  { value: "student", label: "Alumnos" },
  { value: "teacher", label: "Profesores" },
  { value: "group", label: "Grupos" },
  { value: "payroll", label: "Nóminas" },
  { value: "settings", label: "Configuración" },
];

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_CONFIG[action] ?? { label: action, icon: Activity, color: "bg-muted text-muted-foreground" };
  const { label, icon: Icon, color } = cfg;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function EntryRow({ entry }: { entry: ActivityEntry }) {
  const date = new Date(entry.createdAt);
  return (
    <div className="flex items-start gap-4 py-3 px-4 hover:bg-muted/30 transition-colors border-b border-border last:border-0">
      <div className="mt-0.5 shrink-0">
        <ActionBadge action={entry.action} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{entry.entityName}</p>
        {entry.details && (
          <p className="text-xs text-muted-foreground truncate">{entry.details}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <p
          className="text-xs text-muted-foreground"
          title={format(date, "dd/MM/yyyy HH:mm:ss", { locale: es })}
        >
          {formatDistanceToNow(date, { addSuffix: true, locale: es })}
        </p>
        <Badge variant="outline" className="text-xs mt-0.5 font-mono">
          {entry.entityType}
        </Badge>
      </div>
    </div>
  );
}

export default function Actividad() {
  const [entityType, setEntityType] = useState("");
  const { data: entries, isLoading } = useListActivity(
    entityType ? { entityType, limit: 200 } : { limit: 200 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial de actividad</h1>
        <p className="text-muted-foreground mt-1">
          Registro de las últimas acciones realizadas en el panel.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setEntityType(f.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              entityType === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !entries?.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
              <Activity className="h-8 w-8 opacity-30" />
              <p className="text-sm">No hay actividad registrada aún.</p>
            </div>
          ) : (
            <div>
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
