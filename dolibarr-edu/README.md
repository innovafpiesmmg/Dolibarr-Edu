# ERP EDU — Entorno de Empresa Simulada para FP

Sistema ERP **Dolibarr** adaptado para aulas de Formación Profesional de Administración de Empresas.

Cada alumno dispone de su propia empresa simulada dentro de una única instalación compartida. Los profesores gestionan sus grupos de manera independiente.

---

## Índice

1. [Arquitectura](#arquitectura)
2. [Requisitos del servidor](#requisitos-del-servidor)
3. [Instalación paso a paso](#instalación-paso-a-paso)
4. [Configurar Cloudflare](#configurar-cloudflare)
5. [Dar de alta profesores y grupos](#dar-de-alta-profesores-y-grupos)
6. [Dar de alta alumnos](#dar-de-alta-alumnos)
7. [Uso diario](#uso-diario)
8. [Copias de seguridad](#copias-de-seguridad)
9. [Actualización de Dolibarr](#actualización-de-dolibarr)
10. [Resolución de problemas](#resolución-de-problemas)

---

## Arquitectura

```
Internet
   │
   ▼
Cloudflare (HTTPS) ──► Cloudflare Tunnel
                              │
                              ▼
                    ┌─────────────────────────────┐
                    │   Servidor local del centro  │
                    │                             │
                    │  ┌──────────────────────┐   │
                    │  │   Dolibarr (PHP/Web) │   │
                    │  └──────────┬───────────┘   │
                    │             │               │
                    │  ┌──────────▼───────────┐   │
                    │  │   MariaDB (MySQL)    │   │
                    │  └──────────────────────┘   │
                    └─────────────────────────────┘
```

**Módulo clave: MultiCompany**
Dolibarr incluye un módulo nativo de multiempresa que permite tener múltiples entidades (empresas) dentro de una sola instalación. Cada alumno trabaja en su entidad propia, completamente aislada de las demás.

---

## Requisitos del servidor

| Componente | Mínimo recomendado |
|---|---|
| SO | Ubuntu 22.04 LTS o Debian 12 |
| CPU | 2 cores |
| RAM | 4 GB |
| Disco | 40 GB |
| Software | Docker 24+ y Docker Compose 2+ |

**Instalar Docker en Ubuntu/Debian:**

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Cierra sesión y vuelve a entrar para aplicar el grupo
```

---

## Instalación paso a paso

### 1. Clonar / copiar el paquete

```bash
# Opción A: copiar desde este ZIP al servidor
scp dolibarr-edu.zip usuario@servidor:/opt/
ssh usuario@servidor
cd /opt && unzip dolibarr-edu.zip && cd dolibarr-edu

# Opción B: si ya tienes el directorio en el servidor
cd /opt/dolibarr-edu
```

### 2. Crear el fichero de variables de entorno

```bash
cp .env.example .env
nano .env   # Edita todos los valores marcados con "cambia_esta"
```

> ⚠️ **Importante:** cambia todas las contraseñas antes de arrancar.

### 3. Arrancar los contenedores

```bash
docker compose up -d
```

Espera 1-2 minutos mientras se inicializa la base de datos. Puedes ver el progreso con:

```bash
docker compose logs -f dolibarr
```

Cuando veas `Apache/... configured -- resuming normal operations`, Dolibarr está listo.

### 4. Primera conexión y asistente de instalación

Si Dolibarr muestra el asistente de instalación web, complétalo con los datos que pusiste en `.env`. Si arrancó automáticamente (variable `DOLI_ADMIN_LOGIN` configurada), ve directamente al paso siguiente.

### 5. Activar la API REST

1. Entra como administrador: `http://localhost:8069`
2. Ve a **Configuración → Sistema → API/REST**
3. Activa la API y copia la clave (la necesitarás para los scripts)

### 6. Configuración educativa inicial

```bash
export DOLI_URL="http://localhost:8069"
export DOLI_API_KEY="tu_clave_api_aqui"

chmod +x scripts/*.sh
./scripts/setup-inicial.sh
```

---

## Configurar Cloudflare

### Paso 1: Crear el túnel

```bash
# Instalar cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Autenticarse (abre un navegador)
cloudflared tunnel login

# Crear el túnel
cloudflared tunnel create dolibarr-edu
# → Anota el UUID que muestra (ej: a1b2c3d4-...)
```

### Paso 2: Configurar el fichero del túnel

```bash
# Copia el fichero de credenciales generado
cp ~/.cloudflared/<UUID>.json cloudflare/

# Edita la configuración del túnel
nano cloudflare/config.yml
# Sustituye TU_UUID_AQUI y erp.micentro.es
```

### Paso 3: Apuntar el DNS

```bash
cloudflared tunnel route dns dolibarr-edu erp.micentro.es
```

### Paso 4: Reiniciar con el túnel activo

```bash
docker compose restart cloudflared
```

Accede desde cualquier navegador a `https://erp.micentro.es`.

---

## Dar de alta profesores y grupos

Por cada profesor (o por cada grupo si un profesor tiene varios):

```bash
./scripts/crear-grupo.sh \
  --nombre "Ana García" \
  --usuario "ana.garcia" \
  --email "ana.garcia@centro.es" \
  --grupo "1ADM-A" \
  --password "ProfesorPass123!"
```

El script devuelve el **ID del profesor**, que necesitarás para el siguiente paso.

---

## Dar de alta alumnos

### Opción A: desde un CSV (recomendado para grupos completos)

Edita el fichero `scripts/alumnos-ejemplo.csv` con los datos reales:

```
Carlos,López Martín,carlos.lopez,carlos@centro.es,Alumno2024!,1ADM-A
María,Sánchez Ruiz,maria.sanchez,maria@centro.es,Alumno2024!,1ADM-A
```

Luego ejecuta:

```bash
./scripts/crear-alumnos.sh \
  --csv scripts/alumnos.csv \
  --profesor-id 5       # ID que devolvió crear-grupo.sh
```

### Opción B: desde la interfaz web

1. Entra como administrador
2. Ve a **MultiCompany → Entidades → Nueva entidad** (una por alumno)
3. Ve a **Usuarios → Nuevo usuario** y vincula cada usuario a su entidad

---

## Uso diario

### El alumno

1. Accede a `https://erp.micentro.es` con su usuario y contraseña
2. Ve directamente su empresa — no puede ver las de los demás
3. Trabaja con facturas, presupuestos, clientes, proveedores, etc.

### El profesor

1. Accede con su usuario
2. Desde **MultiCompany** puede cambiar de entidad para revisar el trabajo de cada alumno
3. Puede entrar en cualquier empresa de su grupo sin conocer la contraseña del alumno

### El superadministrador (TI del centro)

- Gestiona todos los grupos y profesores
- Hace copias de seguridad
- Actualiza Dolibarr

---

## Copias de seguridad

```bash
# Backup completo (base de datos + ficheros)
docker compose exec db mysqldump -u root -p"${MYSQL_ROOT_PASSWORD}" dolibarr \
  > "backup_$(date +%Y%m%d_%H%M).sql"

# Backup de documentos adjuntos
docker run --rm -v dolibarr-edu_dolibarr_docs:/data \
  -v $(pwd)/backups:/backup alpine \
  tar czf /backup/docs_$(date +%Y%m%d).tar.gz /data
```

Se recomienda programar esto en cron:

```bash
crontab -e
# Añadir esta línea para backup diario a las 22:00:
0 22 * * * cd /opt/dolibarr-edu && ./scripts/backup.sh
```

---

## Actualización de Dolibarr

```bash
# Descargar nueva imagen
docker compose pull dolibarr

# Reiniciar (Dolibarr ejecuta las migraciones automáticamente)
docker compose up -d dolibarr

# Verificar que arrancó bien
docker compose logs -f dolibarr
```

---

## Resolución de problemas

### Dolibarr no arranca

```bash
docker compose logs dolibarr
docker compose logs db
```

### No puedo conectar desde Cloudflare

```bash
# Comprobar que el túnel está activo
docker compose logs cloudflared

# Probar conectividad local
curl -v http://localhost:8069
```

### Un alumno no ve su empresa

Verifica que el usuario esté vinculado a la entidad correcta:
- Administración → Usuarios → [usuario] → Entidad

### Olvidé la contraseña de admin

```bash
docker compose exec db mysql -u root -p"${MYSQL_ROOT_PASSWORD}" dolibarr \
  -e "UPDATE llx_user SET pass_crypted=MD5('nueva_contrasena') WHERE login='admin';"
```

---

## Estructura del paquete

```
dolibarr-edu/
├── docker-compose.yml        ← Definición de los servicios
├── .env.example              ← Plantilla de variables (copia como .env)
├── README.md                 ← Esta guía
├── cloudflare/
│   └── config.yml            ← Configuración del túnel Cloudflare
├── init/
│   └── mariadb.cnf           ← Ajustes de rendimiento de la BD
└── scripts/
    ├── setup-inicial.sh      ← Configuración educativa inicial
    ├── crear-grupo.sh        ← Crear profesor + grupo
    ├── crear-alumnos.sh      ← Alta masiva de alumnos desde CSV
    ├── listar-grupos.sh      ← Ver grupos y alumnos actuales
    └── alumnos-ejemplo.csv   ← Plantilla CSV de alumnos
```
