# NominasEDU — Módulo de nóminas para Dolibarr

Módulo PHP nativo para Dolibarr que añade un completo sistema de gestión de nóminas educativo, diseñado para la FP de Administración de Empresas. Aparece en el menú principal de Dolibarr como cualquier otro módulo oficial.

## Funcionalidades

| Página | Descripción |
|--------|-------------|
| **Lista de nóminas** | Nóminas del período seleccionado con totales de masa salarial, SS y coste empresa |
| **Nueva nómina** | Cálculo en tiempo real de IRPF, SS obrero/empresa, neto y coste total |
| **Detalle de nómina** | Desglose completo con tabla de tipos SS 2024 por partida |
| **Empleados** | Alta, edición y baja de empleados vinculados a usuarios Dolibarr |
| **Liquidación SS/IRPF** | Totales mensuales, registro de pagos a Tesorería y Modelo 111 |

## Tipos de SS aplicados (Régimen General 2024)

### Cuotas obrero — 6,47%
| Concepto | Tipo |
|----------|------|
| Contingencias comunes | 4,70% |
| Desempleo | 1,55% |
| Formación profesional | 0,10% |
| MEI | 0,12% |

### Cuotas empresa — 30,48%
| Concepto | Tipo |
|----------|------|
| Contingencias comunes | 23,60% |
| Desempleo | 5,50% |
| Formación profesional | 0,60% |
| FOGASA | 0,20% |
| MEI | 0,58% |

## Instalación

El módulo se instala automáticamente con el despliegue de Dolibarr EDU, ya que `docker-compose.yml` monta la carpeta `modules/` en `/var/www/html/custom/`.

Si necesitas instalarlo manualmente en un Dolibarr existente:

```bash
# Copia el módulo en la carpeta custom de tu Dolibarr
cp -r nominasedu /ruta/a/dolibarr/htdocs/custom/

# Actívalo desde el panel de administración:
# Configuración → Módulos/Aplicaciones → busca "NominasEDU" → activar
```

Tras activarlo, Dolibarr crea automáticamente las tres tablas necesarias:
- `llx_nominasedu_employee`
- `llx_nominasedu_payroll`
- `llx_nominasedu_ss_payment`

## Activación automática en Docker

El `docker-compose.yml` de Dolibarr EDU incluye el módulo en `DOLI_MODULES` para que se active en el primer arranque. Sin embargo, los módulos custom no se auto-activan por esta variable — **hay que activarlo manualmente** desde el panel admin una vez arrancado Dolibarr:

> **Configuración → Módulos/Aplicaciones → pestaña "Recursos humanos" → NominasEDU → Activar**

## Flujo de trabajo recomendado

1. **Activa el módulo** en Dolibarr admin
2. **Crea empleados** desde el menú NominasEDU → Empleados
   - Vincula cada empleado a su usuario Dolibarr
   - Configura salario base y % IRPF habitual
3. **Genera nóminas** mes a mes desde NominasEDU → Nueva nómina
   - El cálculo es automático en tiempo real
   - Valida la nómina para incluirla en la liquidación
4. **Liquida SS e IRPF** desde NominasEDU → Liquidación SS/IRPF
   - Registra las fechas de pago a Tesorería y Hacienda (Modelo 111)

## Estructura de archivos

```
nominasedu/
├── core/modules/
│   └── modNominasEdu.class.php    ← Descriptor del módulo (permisos, menús, SQL)
├── langs/es_ES/
│   └── nominasedu.lang            ← Cadenas en español
├── lib/
│   └── nominasedu.lib.php         ← Helpers: cálculo de nómina, consultas BD
├── sql/
│   └── llx_nominasedu.sql         ← Creación de las 3 tablas del módulo
├── index.php                      ← Lista de nóminas del período
├── nomina_card.php                ← Crear / ver / validar nómina
├── empleados.php                  ← Gestión de empleados
└── ss.php                         ← Liquidación SS/IRPF por período
```

## Permisos

El módulo define tres niveles de permiso configurables por usuario/rol:

| Permiso | Descripción | Por defecto |
|---------|-------------|-------------|
| `nominasedu.read` | Consultar nóminas y empleados | Activado |
| `nominasedu.write` | Crear y editar nóminas y empleados | Desactivado |
| `nominasedu.delete` | Eliminar registros | Desactivado |

Configúralos en: **Usuarios → [usuario] → Permisos → NominasEDU**
