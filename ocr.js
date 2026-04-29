// ocr.js PRO Applebee's FINAL CORREGIDO

function normalizarTextoBase(texto) {
  return String(texto || "")
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/T\s*0\s*T\s*A\s*L/gi, "TOTAL")
    .replace(/T\s*O\s*T\s*A\s*L/gi, "TOTAL")
    .replace(/T\s*o\s*t\s*a\s*l/gi, "TOTAL")
    .replace(/T0TAL/gi, "TOTAL")
    .replace(/TOTAI/gi, "TOTAL")
    .replace(/TOTA1/gi, "TOTAL")
    .replace(/SUB[-\s]*TOTAL/gi, "SUBTOTAL")
    .replace(/IMP[.\s]*TOTAL/gi, "IMP.TOTAL")
    .replace(/IMPT[.\s]*TOTAL/gi, "IMP.TOTAL")
    .replace(/IVA\s*IMPUESTO/gi, "IVA IMPUESTO")
    .replace(/PROP1NA/gi, "PROPINA")
    .replace(/PR0PINA/gi, "PROPINA");
}

function obtenerLineas(texto) {
  return normalizarTextoBase(texto)
    .split("\n")
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizarMonto(valor) {
  if (!valor) return 0;

  return Number(
    String(valor)
      .replace(/\$/g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
  );
}

function extraerFecha(texto) {
  const limpio = normalizarTextoBase(texto);
  const match = limpio.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);

  if (!match) return "";

  const dd = match[1].padStart(2, "0");
  const mm = match[2].padStart(2, "0");
  const yyyy = match[3];

  return `${yyyy}-${mm}-${dd}`;
}

function extraerFolio(texto) {
  const lineas = obtenerLineas(texto);
  const todo = lineas.join("\n").toUpperCase();

  const ignorar = new Set(["32530", "1585"]);

  let match = todo.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}[\s\S]{0,100}\d{1,2}:\d{2}[\s\S]{0,60}\b(\d{5})\b/);
  if (match && !ignorar.has(match[1])) return match[1];

  const idxFecha = lineas.findIndex(l => /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(l));

  if (idxFecha >= 0) {
    const zona = lineas.slice(idxFecha, idxFecha + 8).join(" ");
    const nums = zona.match(/\b\d{5}\b/g) || [];

    for (const n of nums) {
      if (!ignorar.has(n)) return n;
    }
  }

  for (let i = 0; i < lineas.length; i++) {
    if (/\d{1,2}:\d{2}/.test(lineas[i])) {
      const zonaHora = lineas.slice(i, i + 5).join(" ");
      const nums = zonaHora.match(/\b\d{5}\b/g) || [];

      for (const n of nums) {
        if (!ignorar.has(n)) return n;
      }
    }
  }

  const todos = todo.match(/\b\d{5}\b/g) || [];

  for (const n of todos) {
    if (ignorar.has(n)) continue;
    if (/^[245]\d{4}$/.test(n)) return n;
  }

  return "";
}

function extraerTotal(texto) {
  const lineas = obtenerLineas(texto);

  for (let i = 0; i < lineas.length; i++) {
    const lineaOriginal = lineas[i];
    const linea = lineaOriginal.toUpperCase();
    const lineaSinEspacios = linea.replace(/\s+/g, "");

    if (
      linea.includes("SUBTOTAL") ||
      linea.includes("IVA") ||
      linea.includes("IMP.") ||
      linea.includes("IMPUESTO") ||
      linea.includes("PROPINA") ||
      linea.includes("VISA") ||
      linea.includes("MASTER") ||
      linea.includes("AUTH") ||
      linea.includes("EFECTIVO")
    ) {
      continue;
    }

    const esTotalReal =
      linea.startsWith("TOTAL") ||
      lineaSinEspacios.startsWith("TOTAL");

    if (!esTotalReal) continue;

    const montos = lineaOriginal.match(/\$?\s*\d{1,6}[.,]\d{2}/g);

    if (montos && montos.length) {
      return normalizarMonto(montos[montos.length - 1]).toFixed(2);
    }

    const siguiente = lineas[i + 1] || "";
    const match2 = siguiente.match(/\$?\s*\d{1,6}[.,]\d{2}/);

    if (match2) {
      return normalizarMonto(match2[0]).toFixed(2);
    }
  }

  return "";
}

async function analizarTicketOCR(file) {
  if (!file) throw new Error("No hay imagen.");

  const result = await Tesseract.recognize(file, "spa+eng", {
    logger: m => {
      const status = document.getElementById("ocrStatus");
      if (status && m.status) {
        status.innerText = `OCR: ${m.status} ${Math.round((m.progress || 0) * 100)}%`;
      }
    }
  });

  const textoOriginal = result.data.text || "";

  const folio = extraerFolio(textoOriginal);
  const fecha = extraerFecha(textoOriginal);
  const total = extraerTotal(textoOriginal);

  console.log("===== OCR ORIGINAL =====");
  console.log(textoOriginal);
  console.table(obtenerLineas(textoOriginal));
  console.log({ folio, fecha, total });

  return { folio, fecha, total };
}
