// ocr.js PRO Applebee's FINAL

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

  let dd = match[1].padStart(2, "0");
  let mm = match[2].padStart(2, "0");
  const yyyy = match[3];

  return `${yyyy}-${mm}-${dd}`;
}

function extraerFolio(texto) {
  const lineas = obtenerLineas(texto);
  const todo = lineas.join("\n").toUpperCase();

  const ignorar = new Set(["32530", "1585"]);

  // 🔥 1. Fecha + hora + folio (caso ideal)
  let match = todo.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}[\s\S]{0,80}\d{1,2}:\d{2}[\s\S]{0,40}\b(\d{5})\b/);
  if (match && !ignorar.has(match[1])) return match[1];

  // 🔥 2. Cerca de la fecha
  const idxFecha = lineas.findIndex(l => /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(l));

  if (idxFecha >= 0) {
    const zona = lineas.slice(idxFecha, idxFecha + 6).join(" ");
    const nums = zona.match(/\b\d{5}\b/g) || [];

    for (const n of nums) {
      if (!ignorar.has(n)) return n;
    }
  }

  // 🔥 3. NUEVO: cerca de la hora (esto corrige tu error actual)
  for (let i = 0; i < lineas.length; i++) {
    if (/\d{1,2}:\d{2}/.test(lineas[i])) {
      const zonaHora = lineas.slice(i, i + 4).join(" ");
      const nums = zonaHora.match(/\b\d{5}\b/g) || [];

      for (const n of nums) {
        if (!ignorar.has(n)) return n;
      }
    }
  }

  // 🔥 4. Fallback INTELIGENTE (evita números basura)
  const todos = todo.match(/\b\d{5}\b/g) || [];

  for (const n of todos) {
    if (ignorar.has(n)) continue;

    // solo acepta folios válidos tipo Applebee's
    if (/^[245]\d{4}$/.test(n)) {
      return n;
    }
  }

  return "";
}

function extraerTotal(texto) {
  const lineas = obtenerLineas(texto);

  for (let i = 0; i < lineas.length; i++) {
    const lineaOriginal = lineas[i];
    const linea = lineaOriginal.toUpperCase();

    // ❌ ignorar campos incorrectos
    if (
      linea.includes("SUBTOTAL") ||
      linea.includes("IVA") ||
      linea.includes("IMP") ||
      linea.includes("PROPINA") ||
      linea.includes("VISA") ||
      linea.includes("MASTER") ||
      linea.includes("AUTH")
    ) {
      continue;
    }

    // ✅ SOLO TOTAL REAL
    if (/^TOTAL\b/.test(linea)) {

      const montos = lineaOriginal.match(/\d+[.,]\d{2}/g);

      if (montos) {
        return normalizarMonto(montos[montos.length - 1]).toFixed(2);
      }

      const siguiente = lineas[i + 1] || "";
      const match2 = siguiente.match(/\d+[.,]\d{2}/);

      if (match2) {
        return normalizarMonto(match2[0]).toFixed(2);
      }
    }
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

  console.log("===== LINEAS =====");
  console.table(obtenerLineas(textoOriginal));

  console.log("===== RESULTADO FINAL =====");
  console.log({ folio, fecha, total });

  return { folio, fecha, total };
}
