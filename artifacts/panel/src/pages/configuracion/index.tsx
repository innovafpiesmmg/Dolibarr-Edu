import { useState, useEffect } from "react";
import { useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Settings, Globe, Euro, Receipt, Server } from "lucide-react";
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
  const [baseDomain, setBaseDomain] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!settings) return;
    if (settings.taxSystem) setTaxSystem(settings.taxSystem as TaxSystem);
    if (settings.baseDomain !== undefined) setBaseDomain(settings.baseDomain);
  }, [settings]);

  const handleSave = () => {
    updateSettings(
      { data: { taxSystem, baseDomain } },
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
    settings?.baseDomain !== baseDomain;

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

      {/* Dominio base de los Dolibarr de alumnos */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Dominio base de Dolibarr</CardTitle>
          </div>
          <CardDescription>
            Cada alumno tendrá su propio Dolibarr en{" "}
            <code className="text-xs bg-muted px-1 rounded">https://&lt;usuario&gt;.&lt;dominio&gt;/</code>.
            Configura el túnel Cloudflare con un comodín{" "}
            <code className="text-xs bg-muted px-1 rounded">*.dominio</code> apuntando a Traefik.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-10 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="space-y-1.5">
              <Label>Dominio base</Label>
              <Input
                value={baseDomain}
                onChange={(e) => setBaseDomain(e.target.value.trim().toLowerCase())}
                placeholder="erp.iesmmg.es"
                spellCheck={false}
              />
              {baseDomain && (
                <p className="text-xs text-muted-foreground">
                  Ejemplo de acceso de alumno:{" "}
                  <code className="bg-muted px-1 rounded">https://juan-perez.{baseDomain}/</code>
                </p>
              )}
            </div>
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
