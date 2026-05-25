import { useState, useEffect } from "react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Settings, Globe, Euro, Receipt, FolderKanban, FileSpreadsheet, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

type TaxSystem = "iva" | "igic";

const TAX_OPTIONS: { value: TaxSystem; label: string; subtitle: string; detail: string; badge: string }[] = [
  {
    value: "igic",
    label: "IGIC",
    subtitle: "Impuesto General Indirecto Canario",
    detail: "Para centros educativos en las Islas Canarias. Tipo general: 7%.",
    badge: "Canarias",
  },
  {
    value: "iva",
    label: "IVA",
    subtitle: "Impuesto sobre el Valor Añadido",
    detail: "Para centros educativos en la Península, Ceuta o Melilla. Tipo general: 21%.",
    badge: "Régimen general",
  },
];

export default function Configuracion() {
  const { data: settings, isLoading } = useGetSettings();
  const { mutate: updateSettings, isPending } = useUpdateSettings();

  const [taxSystem, setTaxSystem] = useState<TaxSystem>("igic");
  const [openprojectUrl, setOpenprojectUrl] = useState("");
  const [collaboraUrl, setCollaboraUrl] = useState("");
  const [nextcloudUrl, setNextcloudUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    if (settings.taxSystem) setTaxSystem(settings.taxSystem as TaxSystem);
    if (settings.openprojectUrl !== undefined) setOpenprojectUrl(settings.openprojectUrl);
    if (settings.collaboraUrl !== undefined) setCollaboraUrl(settings.collaboraUrl);
    if ((settings as any).nextcloudUrl !== undefined) setNextcloudUrl((settings as any).nextcloudUrl);
  }, [settings]);

  const handleSave = () => {
    updateSettings(
      { data: { taxSystem, openprojectUrl, collaboraUrl, nextcloudUrl } as any },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      },
    );
  };

  const isDirty =
    settings?.taxSystem !== taxSystem ||
    settings?.openprojectUrl !== openprojectUrl ||
    settings?.collaboraUrl !== collaboraUrl ||
    (settings as any)?.nextcloudUrl !== nextcloudUrl;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-1">
          Ajustes generales del panel y del ERP Dolibarr.
        </p>
      </div>

      {/* Régimen fiscal */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Régimen fiscal</CardTitle>
          </div>
          <CardDescription>
            Determina el impuesto indirecto que se aplica al crear empresas en Dolibarr.
            Este ajuste afecta a todos los alumnos que se desplieguen desde ahora.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="h-24 rounded-lg bg-muted animate-pulse" />
          ) : (
            TAX_OPTIONS.map((opt) => {
              const selected = taxSystem === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTaxSystem(opt.value)}
                  className={cn(
                    "w-full rounded-lg border-2 p-4 text-left transition-all",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{opt.label}</span>
                        <Badge variant="secondary" className="text-xs">
                          {opt.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{opt.subtitle}</p>
                      <p className="text-xs text-muted-foreground">{opt.detail}</p>
                    </div>
                    {selected && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* URLs de herramientas externas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">URLs de herramientas</CardTitle>
          </div>
          <CardDescription>
            Direcciones públicas de OpenProject y Collabora Online. Se usan en los enlaces del
            panel y en la landing page del alumno. Incluye el protocolo (ej: <code>https://proyectos.micentro.es</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
              <div className="h-10 rounded-lg bg-muted animate-pulse" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <FolderKanban className="h-3.5 w-3.5" />
                  OpenProject
                </Label>
                <Input
                  value={openprojectUrl}
                  onChange={(e) => setOpenprojectUrl(e.target.value)}
                  placeholder="https://proyectos.micentro.es"
                  type="url"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Collabora Online (LibreOffice)
                </Label>
                <Input
                  value={collaboraUrl}
                  onChange={(e) => setCollaboraUrl(e.target.value)}
                  placeholder="https://office.micentro.es"
                  type="url"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5" />
                  Nextcloud
                </Label>
                <Input
                  value={nextcloudUrl}
                  onChange={(e) => setNextcloudUrl(e.target.value)}
                  placeholder="https://cloud.micentro.es"
                  type="url"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ERP — valores fijos */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Configuración del ERP</CardTitle>
          </div>
          <CardDescription>
            Parámetros aplicados automáticamente a cada empresa creada en Dolibarr.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Idioma</p>
              <p className="text-xs text-muted-foreground">Español (es_ES)</p>
            </div>
            <Badge variant="outline">Fijo</Badge>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Euro className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Moneda</p>
              <p className="text-xs text-muted-foreground">Euro (EUR, €)</p>
            </div>
            <Badge variant="outline">Fijo</Badge>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!isDirty || isPending}>
          {isPending ? "Guardando…" : "Guardar configuración"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Guardado correctamente
          </span>
        )}
      </div>
    </div>
  );
}
