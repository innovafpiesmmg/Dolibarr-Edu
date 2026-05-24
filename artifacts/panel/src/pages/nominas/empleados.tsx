import { useState } from "react";
import { Link } from "wouter";
import {
  useListEmployees,
  useCreateEmployee,
  useDeleteEmployee,
  useListStudents,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Edit, Users2, AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const GROUPS: Record<number, string> = {
  1: "Gr.1 — Ingenieros/Licenciados",
  2: "Gr.2 — Ing. Técnicos/Peritos",
  3: "Gr.3 — Jefes Administrativos",
  4: "Gr.4 — Ayudantes no titulados",
  5: "Gr.5 — Oficiales Administrativos",
  6: "Gr.6 — Subalternos",
  7: "Gr.7 — Auxiliares Administrativos",
  8: "Gr.8 — Oficiales 1ª y 2ª",
  9: "Gr.9 — Oficiales 3ª y Especialistas",
  10: "Gr.10 — Peones",
  11: "Gr.11 — Menores de 18 años",
};

interface EmployeeForm {
  firstName: string;
  lastName: string;
  dni: string;
  jobTitle: string;
  contractType: "indefinido" | "temporal";
  groupCategory: number;
  salaryBase: string;
  extraPayments: 12 | 14;
  irpfRate: string;
}

const defaultForm = (): EmployeeForm => ({
  firstName: "",
  lastName: "",
  dni: "",
  jobTitle: "",
  contractType: "indefinido",
  groupCategory: 7,
  salaryBase: "",
  extraPayments: 14,
  irpfRate: "15",
});

export default function NominasEmpleados() {
  const [studentId, setStudentId] = useState<number | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [form, setForm] = useState<EmployeeForm>(defaultForm());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: students } = useListStudents({});
  const { data: employees, isLoading } = useListEmployees(
    { studentId: studentId ?? 0 },
    { query: { enabled: !!studentId, queryKey: ["listEmployees", studentId] } },
  );

  const createMut = useCreateEmployee();
  const deleteMut = useDeleteEmployee();

  const handleSave = () => {
    if (!studentId) return;
    createMut.mutate(
      {
        data: {
          studentId,
          firstName: form.firstName,
          lastName: form.lastName,
          dni: form.dni || undefined,
          jobTitle: form.jobTitle,
          contractType: form.contractType,
          groupCategory: form.groupCategory,
          salaryBase: Number(form.salaryBase),
          extraPayments: form.extraPayments,
          irpfRate: Number(form.irpfRate),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listEmployees"] });
          setShowForm(false);
          setForm(defaultForm());
          toast({ title: "Trabajador creado correctamente" });
        },
        onError: () => toast({ variant: "destructive", title: "Error al crear el trabajador" }),
      },
    );
  };

  const handleDelete = () => {
    if (!toDelete) return;
    deleteMut.mutate(
      { id: toDelete },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listEmployees"] });
          setToDelete(null);
          toast({ title: "Trabajador eliminado" });
        },
        onError: () => toast({ variant: "destructive", title: "Error al eliminar el trabajador" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/nominas"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users2 className="h-6 w-6 text-primary" /> Trabajadores
            </h1>
            <p className="text-muted-foreground text-sm">Alta y gestión de empleados de cada empresa</p>
          </div>
        </div>
        {studentId && (
          <Button onClick={() => { setForm(defaultForm()); setShowForm(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo Trabajador
          </Button>
        )}
      </div>

      <div className="flex gap-4 items-center bg-card p-4 rounded-lg border">
        <div className="text-sm text-muted-foreground">Empresa del alumno:</div>
        <Select
          value={studentId?.toString() ?? "none"}
          onValueChange={(v) => setStudentId(v === "none" ? undefined : Number(v))}
        >
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Seleccionar alumno…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Seleccionar alumno —</SelectItem>
            {students?.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.firstName} {s.lastName} — {s.companyName ?? "Sin empresa"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {studentId ? (
        <Card>
          <CardHeader>
            <CardTitle>Plantilla de trabajadores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Trabajador</TableHead>
                  <TableHead>Cargo / Grupo</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">Salario Base</TableHead>
                  <TableHead className="text-right">Pagas</TableHead>
                  <TableHead className="text-right">IRPF%</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : employees?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No hay trabajadores. Añade el primero para empezar.
                    </TableCell>
                  </TableRow>
                ) : (
                  employees?.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="pl-6">
                        <div className="font-medium">{emp.firstName} {emp.lastName}</div>
                        {emp.dni && <div className="text-xs text-muted-foreground">{emp.dni}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{emp.jobTitle}</div>
                        <div className="text-xs text-muted-foreground">{GROUPS[emp.groupCategory]}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.contractType === "indefinido" ? "default" : "secondary"} className="text-xs">
                          {emp.contractType === "indefinido" ? "Indefinido" : "Temporal"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(emp.salaryBase)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-xs">{emp.extraPayments} pagas</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{emp.irpfRate}%</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setToDelete(emp.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="flex items-center justify-center h-40 rounded-lg border border-dashed text-muted-foreground">
          Selecciona un alumno para ver y gestionar sus trabajadores
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo Trabajador</DialogTitle>
            <DialogDescription>Datos del empleado para la nómina</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Carlos" />
            </div>
            <div className="space-y-2">
              <Label>Apellidos *</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="López Martín" />
            </div>
            <div className="space-y-2">
              <Label>DNI/NIE</Label>
              <Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} placeholder="12345678A" />
            </div>
            <div className="space-y-2">
              <Label>Cargo *</Label>
              <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Administrativo" />
            </div>
            <div className="space-y-2">
              <Label>Grupo de cotización</Label>
              <Select value={String(form.groupCategory)} onValueChange={(v) => setForm({ ...form, groupCategory: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GROUPS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de contrato</Label>
              <Select value={form.contractType} onValueChange={(v) => setForm({ ...form, contractType: v as "indefinido" | "temporal" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indefinido">Indefinido</SelectItem>
                  <SelectItem value="temporal">Temporal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Salario base mensual *</Label>
              <Input
                type="number"
                value={form.salaryBase}
                onChange={(e) => setForm({ ...form, salaryBase: e.target.value })}
                placeholder="1.800,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Pagas anuales</Label>
              <Select value={String(form.extraPayments)} onValueChange={(v) => setForm({ ...form, extraPayments: Number(v) as 12 | 14 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14 pagas (2 extras)</SelectItem>
                  <SelectItem value="12">12 pagas (extras prorrateadas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Retención IRPF (%)</Label>
              <Input
                type="number"
                value={form.irpfRate}
                onChange={(e) => setForm({ ...form, irpfRate: e.target.value })}
                placeholder="15"
              />
              <p className="text-xs text-muted-foreground">Porcentaje de retención según situación personal del trabajador</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || !form.firstName || !form.lastName || !form.jobTitle || !form.salaryBase}
            >
              <Save className="mr-2 h-4 w-4" />
              {createMut.isPending ? "Guardando..." : "Guardar Trabajador"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Eliminar trabajador
            </DialogTitle>
            <DialogDescription>Se eliminarán también todas sus nóminas. Esta acción es irreversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
