---
name: Equipos = contenedor Dolibarr propio (no compartido)
description: Por qué cada equipo tiene su propio contenedor Dolibarr en vez de reusar el del profesor o el de un alumno.
---

Cada equipo despliega un contenedor Dolibarr INDEPENDIENTE (no se reutiliza el del profe ni el de un alumno). El profe es admin de ese Dolibarr usando sus mismas credenciales del Dolibarr individual.

**Why:** Reutilizar el Dolibarr del profe se descartó porque mezclaba datos del equipo con la cuenta personal del docente y obligaba a permisos/usuarios complejos; reutilizar el de un alumno sesgaba la propiedad. Aislar por contenedor mantiene la simetría con el modelo "un contenedor por alumno" y permite borrar/destruir un equipo sin tocar nada más.

**How to apply:**
- Al unir un alumno a un equipo: `stop` (no destroy) de su Dolibarr individual y provisión en el del equipo con su misma `dolibarrPassword`. Al salir o al borrar el equipo: `start` del individual.
- Requisito: el Dolibarr individual del profesor debe estar desplegado primero (de ahí salen las credenciales admin del Dolibarr del equipo).
- Naming/routing siguen el mismo patrón que alumnos (Traefik file provider apuntando al contenedor del equipo). No usar el contenedor del profe como target.
