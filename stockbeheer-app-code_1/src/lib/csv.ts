// Kleine, zelfgeschreven CSV-parser (geen extra dependency nodig) die
// aanhalingstekens en zowel komma als puntkomma als scheidingsteken
// ondersteunt — voldoende robuust voor een export vanuit Excel/Google
// Sheets. Gedeeld tussen client- en servercode.

export function detecteerDelimiter(eersteLijn: string): string {
  const puntkomma = (eersteLijn.match(/;/g) || []).length;
  const komma = (eersteLijn.match(/,/g) || []).length;
  return puntkomma > komma ? ";" : ",";
}

export function parseCsv(tekst: string, delimiter: string): string[][] {
  const rijen: string[][] = [];
  let rij: string[] = [];
  let veld = "";
  let inQuotes = false;
  const len = tekst.length;
  let i = 0;
  while (i < len) {
    const ch = tekst[i];
    if (inQuotes) {
      if (ch === '"') {
        if (tekst[i + 1] === '"') {
          veld += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        veld += ch;
        i += 1;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === delimiter) {
      rij.push(veld);
      veld = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      rij.push(veld);
      rijen.push(rij);
      rij = [];
      veld = "";
      i += 1;
      continue;
    }
    veld += ch;
    i += 1;
  }
  if (veld.length > 0 || rij.length > 0) {
    rij.push(veld);
    rijen.push(rij);
  }
  return rijen.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

// Ondersteunt zowel "12.5" als het Belgische "12,5".
export function parseNummer(ruw: string): number | null {
  let s = ruw.trim().replace(/[€\s]/g, "");
  if (!s) return null;
  const heeftKomma = s.includes(",");
  const heeftPunt = s.includes(".");
  if (heeftKomma && heeftPunt) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (heeftKomma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseGeheelGetal(ruw: string): number | null {
  const n = parseNummer(ruw);
  if (n === null) return null;
  return Math.round(n);
}
