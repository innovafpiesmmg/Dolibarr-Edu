// Helpers para subdominios y naming de equipos colaborativos.
// IMPORTANTE: cada equipo apunta al contenedor Dolibarr del PROFESOR del grupo.
// Los miembros del equipo son usuarios Dolibarr creados dentro de ese contenedor.

export function teamSlug(groupSlug: string, letter: string): string {
  const safeGroup = (groupSlug || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  const safeLetter = (letter || "x").toLowerCase().replace(/[^a-z]/g, "").slice(0, 2) || "x";
  return `equipo-${safeLetter}-${safeGroup}`;
}

export function publicHostname(groupSlug: string, letter: string, baseDomain: string): string {
  return `${teamSlug(groupSlug, letter)}.${baseDomain}`;
}

export function publicUrl(groupSlug: string, letter: string, baseDomain: string): string {
  return `https://${publicHostname(groupSlug, letter, baseDomain)}`;
}

export function groupNameToSlug(groupName: string): string {
  return groupName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

// Letra correlativa: A, B, C... a partir de un conjunto de letras ya usadas.
export function nextLetter(used: string[]): string {
  const set = new Set(used.map((l) => l.toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const l = String.fromCharCode(65 + i);
    if (!set.has(l)) return l;
  }
  throw new Error("No quedan letras libres (>26 equipos por grupo)");
}
