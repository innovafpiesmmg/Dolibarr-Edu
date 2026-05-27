---
name: Doble contraseña por alumno
description: Cada alumno tiene dos contraseñas (panel y Dolibarr); el login de la landing debe aceptar ambas porque el profesor solo entrega la de Dolibarr.
---

# Contraseña del alumno: panel vs. Dolibarr

Cada alumno tiene **dos** contraseñas conviviendo en la BD del panel:

- `students.passwordHash` — SHA-256 de la contraseña que el profesor escribió en el form al crear el alumno (o que vino en el CSV de importación).
- `students.dolibarrPassword` — contraseña determinista (`SHA-256(<role>:<username> + SESSION_SECRET)`) generada en `student-deploy.ts` al desplegar el contenedor. Sirve como password del usuario admin dentro del Dolibarr del alumno y se muestra en plano en la ficha del alumno (con botón copiar).

## Regla

`POST /auth/student-login` debe aceptar **cualquiera de las dos** como válida.

**Why:** la UI del panel muestra `dolibarrPassword` en la ficha del alumno (es la única "visible") y los profesores en la práctica entregan esa al alumno — la que pusieron al crearlo se les olvida o ni la apuntan. Si la landing solo valida `passwordHash`, el alumno introduce la contraseña que ve en su ficha y obtiene "Usuario o contraseña incorrectos", sin pista de qué falla.

**How to apply:** mantener la validación dual en `auth.ts → /auth/student-login`. Si en algún momento se rediseñan las contraseñas, la opción más limpia es unificarlas (sincronizar `passwordHash = SHA-256(dolibarrPassword)` en el `deploy` y en `reset-password`) y dejar una sola; no eliminar una sin la otra.
