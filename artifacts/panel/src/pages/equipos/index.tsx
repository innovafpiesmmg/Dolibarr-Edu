import { useState } from "react";
import {
  useListTeams,
  useCreateTeam,
  useGetTeam,
  useDeleteTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useListGroups,
  useListStudents,
  getListTeamsQueryKey,
  getGetTeamQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ExternalLink, UserPlus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

function TeamDetail({ teamId, onClose }: { teamId: number; onClose: () => void }) {
  const { data: team, isLoading } = useGetTeam(teamId);
  const { data: students } = useListStudents({ groupId: team?.groupId });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [studentToAdd, setStudentToAdd] = useState<number | undefined>();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(teamId) });
    queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
  };
  const addMember = useAddTeamMember({ mutation: { onSuccess: () => { invalidate(); setStudentToAdd(undefined); toast({ title: "Miembro añadido" }); }, onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err?.data?.error ?? "" }) } });
  const removeMember = useRemoveTeamMember({ mutation: { onSuccess: () => { invalidate(); toast({ title: "Miembro quitado" }); } } });

  const availableStudents = (students ?? []).filter((s) => !(team?.members ?? []).some((m) => m.id === s.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{team ? `Equipo ${team.letter} — ${team.name}` : "Equipo"}</DialogTitle>
          <DialogDescription>{team?.groupName} · Profesor: {team?.teacherUsername}</DialogDescription>
        </DialogHeader>
        {isLoading || !team ? <Skeleton className="h-40" /> : (
          <div className="space-y-4">
            {team.publicUrl && (
              <a href={team.publicUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary inline-flex items-center gap-1 hover:underline">
                <ExternalLink className="h-3 w-3" /> {team.publicUrl}
              </a>
            )}
            <Badge variant={team.dolibarrSyncStatus === "synced" ? "default" : "secondary"}>{team.dolibarrSyncStatus}</Badge>

            <div>
              <h3 className="font-semibold mb-2">Miembros ({team.members.length})</h3>
              {team.members.length === 0 ? <p className="text-sm text-muted-foreground">Sin miembros.</p> : (
                <ul className="space-y-2">
                  {team.members.map((m) => (
                    <li key={m.id} className="flex items-center justify-between text-sm border border-border rounded-lg px-3 py-2">
                      <div>
                        <div className="font-medium">{m.firstName} {m.lastName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{m.username}</div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeMember.mutate({ id: teamId, studentId: m.id })}>
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label>Añadir alumno del grupo</Label>
                <Select value={studentToAdd ? String(studentToAdd) : ""} onValueChange={(v) => setStudentToAdd(Number(v))}>
                  <SelectTrigger><SelectValue placeholder={availableStudents.length === 0 ? "No hay alumnos disponibles" : "Selecciona un alumno"} /></SelectTrigger>
                  <SelectContent>
                    {availableStudents.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button disabled={!studentToAdd || addMember.isPending} onClick={() => studentToAdd && addMember.mutate({ id: teamId, data: { studentId: studentToAdd } })}>
                <UserPlus className="h-4 w-4 mr-2" />Añadir
              </Button>
            </div>
          </div>
        )}
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cerrar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EquiposAdmin() {
  const { data: teams, isLoading } = useListTeams();
  const { data: groups } = useListGroups({});
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openTeamId, setOpenTeamId] = useState<number | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<number | null>(null);
  const [form, setForm] = useState({ groupId: 0, name: "" });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
  const createTeam = useCreateTeam({ mutation: { onSuccess: () => { invalidate(); setIsCreateOpen(false); setForm({ groupId: 0, name: "" }); toast({ title: "Equipo creado" }); }, onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err?.data?.error ?? "" }) } });
  const deleteTeam = useDeleteTeam({ mutation: { onSuccess: () => { invalidate(); setTeamToDelete(null); toast({ title: "Equipo eliminado" }); } } });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Equipos</h1>
          <p className="text-muted-foreground">Equipos colaborativos de todos los profesores.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nuevo equipo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Crear equipo</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); if (!form.groupId || !form.name) return; createTeam.mutate({ data: form }); }} className="space-y-3">
              <div className="space-y-1">
                <Label>Grupo</Label>
                <Select value={form.groupId ? String(form.groupId) : ""} onValueChange={(v) => setForm({ ...form, groupId: Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona un grupo" /></SelectTrigger>
                  <SelectContent>
                    {(groups ?? []).map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name} — {g.teacherName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Nombre del equipo</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Marketing" /></div>
              <DialogFooter><Button type="submit" disabled={createTeam.isPending}>Crear</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-32" /> : !teams || teams.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">No hay equipos creados.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <div key={t.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{t.groupName}</div>
                  <div className="font-semibold">Equipo {t.letter} — {t.name}</div>
                </div>
                <Badge variant={t.dolibarrSyncStatus === "synced" ? "default" : "secondary"}>{t.dolibarrSyncStatus}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{t.memberCount} miembros</div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => setOpenTeamId(t.id)}>Gestionar</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setTeamToDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {openTeamId && <TeamDetail teamId={openTeamId} onClose={() => setOpenTeamId(null)} />}

      <Dialog open={teamToDelete !== null} onOpenChange={(o) => !o && setTeamToDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>¿Eliminar equipo?</DialogTitle><DialogDescription>Los miembros volverán a su Dolibarr individual.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTeamToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => teamToDelete && deleteTeam.mutate({ id: teamToDelete })}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
