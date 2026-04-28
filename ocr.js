// ocr.js PRO Applebee's

function normalizarTextoBase(texto) {
  return String(texto || "")
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/T0TAL/gi, "TOTAL")
    .replace(/TOTAI/gi, "TOTAL")
    .replace(/TOTA1/gi, "TOTAL")
    .replace(/T0TA1/gi, "TOTAL")
    .replace(/TOTL/gi, "TOTAL")
    .replace(/SUB[-\s]*TOTAL/gi, "SUBTOTAL")
    .replace(/SUB[-\s]*T0TAL/gi, "SUBTOTAL")
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

  let v = String(valor)
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  return Number(v);
}

function extraerFecha(texto) {
  const limpio = normalizarTextoBase(texto);

  const match = limpio.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (!match) return "";

  let dd = match[1].padStart(2, "0");
  let mm = match[2].padStart(2, "0");
  const yyyy = match[3];

  return `${yyyy}-${mm}-${dd}`;
}

function extraerFolio(texto) {
  const lineas = obtenerLineas(texto);
  const todo = lineas.join("\n").toUpperCase();

  const ignorar = new Set([
    "32530", // CP
    "1585"   // dirección si el OCR la llega a confundir
  ]);

  // 1. Mejor caso: fecha, hora y folio vienen juntos en el mismo bloque
  let match = todo.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}[\s\S]{0,80}\d{1,2}:\d{2}\s*(?:AM|PM)?[\s\S]{0,40}\b(\d{5})\b/i);
  if (match && !ignorar.has(match[1])) return match[1];

  // 2. Buscar folio en las líneas cercanas a la fecha
  const idxFecha = lineas.findIndex(l => /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(l));

  if (idxFecha >= 0) {
    const zona = lineas.slice(idxFecha, idxFecha + 5).join(" ");
    const nums = zona.match(/\b\d{5}\b/g) || [];

    for (const n of nums) {
      if (!ignorar.has(n)) return n;
    }
  }

  // 3. Buscar número de 5 dígitos cerca de la hora
  match = todo.match(/\d{1,2}:\d{2}\s*(?:AM|PM)?[\s\S]{0,40}\b(\d{5})\b/i);
  if (match && !ignorar.has(match[1])) return match[1];

  // 4. Fallback: todos los números de 5 dígitos, ignorando CP
  const todos = todo.match(/\b\d{5}\b/g) || [];

  for (const n of todos) {
    if (!ignorar.has(n)) return n;
  }

  return "";
}

function extraerTotal(texto) {
  const lineas = obtenerLineas(texto);

  /*
    Queremos este:
    Total          546.00

    Y NO estos:
    Sub-total      470.69
    IVA Impuesto    75.31
    Imp.Total       75.31
    Propina         81.90
    Total           627.90  ← este es total con propina, se ignora
  */

  for (let i = 0; i < lineas.length; i++) {
    const lineaOriginal = lineas[i];
    const linea = lineaOriginal.toUpperCase();

    // Ignorar campos que no son el total real
    if (
      linea.includes("SUBTOTAL") ||
      linea.includes("SUB-TOTAL") ||
      linea.includes("IVA") ||
      linea.includes("IMPUESTO") ||
      linea.includes("IMP.TOTAL") ||
      linea.includes("IMPTOTAL") ||
      linea.includes("PROPINA") ||
      linea.includes("EFECTIVO") ||
      linea.includes("VISA") ||
      linea.includes("MASTER") ||
      linea.includes("AUTH")
    ) {
      continue;
    }

    // Debe empezar con TOTAL o ser TOTAL exacto
    const esLineaTotal =
      /^TOTAL\b/.test(linea) ||
      /^T0TAL\b/.test(linea) ||
      /^TOTAI\b/.test(linea) ||
      /^TOTA1\b/.test(linea);

    if (!esLineaTotal) continue;

    // Tomar el monto de esa misma línea
    const montosLinea = lineaOriginal.match(/\$?\s*\d{1,5}[.,]\d{2}/g);

    if (montosLinea && montosLinea.length) {
      const monto = normalizarMonto(montosLinea[montosLinea.length - 1]);

      // filtro lógico: normalmente el total real es mayor a 50
      if (monto > 0) {
        return monto.toFixed(2);
      }
    }

    // Si OCR separó el monto en la siguiente línea
    const siguiente = lineas[i + 1] || "";
    const montosSig = siguiente.match(/\$?\s*\d{1,5}[.,]\d{2}/g);

    if (montosSig && montosSig.length) {
      const monto = normalizarMonto(montosSig[0]);
      if (monto > 0) return monto.toFixed(2);
    }
  }

  // Fallback inteligente:
  // buscar todos los montos después de "IMP.TOTAL" y antes de "PROPINA"
  const textoCompleto = lineas.join("\n").toUpperCase();

  const zonaTotal = textoCompleto.match(/IMP\.?TOTAL[\s\S]{0,120}?TOTAL[\s\S]{0,40}?(\d{1,5}[.,]\d{2})/i);
  if (zonaTotal && zonaTotal[1]) {
    return normalizarMonto(zonaTotal[1]).toFixed(2);
  }

  return "";
}

async function analizarTicketOCR(file) {
  if (!file) {
    throw new Error("No hay imagen.");
  }

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

  console.log("===== LINEAS OCR =====");
  console.table(obtenerLineas(textoOriginal));

  console.log("===== RESULTADO OCR =====");
  console.log({ folio, fecha, total });

  return {
    folio,
    fecha,
    total
  };
}
