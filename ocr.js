// ocr.js PRODUCCIÓN Applebee's

async function prepararImagenOCR(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxWidth = 1600;
      const scale = Math.min(maxWidth / img.width, 1);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
        const contrast = gray > 145 ? 255 : 0;

        data[i] = contrast;
        data[i + 1] = contrast;
        data[i + 2] = contrast;
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(blob => {
        if (!blob) reject("No se pudo procesar imagen");
        else resolve(blob);
      }, "image/png");
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function limpiarTextoOCR(texto) {
  return String(texto || "")
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/T\s*O\s*T\s*A\s*L/gi, "TOTAL")
    .replace(/T\s*0\s*T\s*A\s*L/gi, "TOTAL")
    .replace(/T\s*o\s*t\s*a\s*l/gi, "TOTAL")
    .replace(/T0TAL|TOTAI|TOTA1|T0TA1|TOTL/gi, "TOTAL")
    .replace(/SUB[-\s]*TOTAL|SUB[-\s]*T0TAL/gi, "SUBTOTAL")
    .replace(/IMP[.\s]*TOTAL|IMPT[.\s]*TOTAL/gi, "IMP.TOTAL")
    .replace(/IVA\s*IMPUESTO/gi, "IVA IMPUESTO")
    .replace(/PROP1NA|PR0PINA/gi, "PROPINA");
}

function obtenerLineas(texto) {
  return limpiarTextoOCR(texto)
    .split("\n")
    .map(l => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizarMonto(valor) {
  return Number(
    String(valor || "")
      .replace("$", "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
  );
}

function extraerFecha(texto) {
  const limpio = limpiarTextoOCR(texto);

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

  let match = todo.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}[\s\S]{0,90}\d{1,2}:\d{2}[\s\S]{0,60}\b(\d{5})\b/);
  if (match && !ignorar.has(match[1])) return match[1];

  const idxFecha = lineas.findIndex(l => /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(l));

  if (idxFecha >= 0) {
    const zona = lineas.slice(idxFecha, idxFecha + 7).join(" ");
    const nums = zona.match(/\b\d{5}\b/g) || [];

    for (const n of nums) {
      if (!ignorar.has(n)) return n;
    }
  }

  for (let i = 0; i < lineas.length; i++) {
    if (/\d{1,2}:\d{2}/.test(lineas[i])) {
      const zonaHora = lineas.slice(i, i + 4).join(" ");
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
    const lineaCompacta = linea.replace(/\s+/g, "");

    // Ignorar totales incorrectos
    if (
      linea.includes("SUBTOTAL") ||
      linea.includes("SUB-TOTAL") ||
      linea.includes("IVA") ||
      linea.includes("IMPUESTO") ||
      linea.includes("IMP.TOTAL") ||
      linea.includes("IMPTOTAL") ||
      linea.includes("PROPINA") ||
      linea.includes("VISA") ||
      linea.includes("MASTER") ||
      linea.includes("AUTH") ||
      linea.includes("EFECTIVO")
    ) {
      continue;
    }

    // Detecta TOTAL normal y T o t a l separado
    const esTotal =
      linea.startsWith("TOTAL") ||
      lineaCompacta.startsWith("TOTAL");

    if (!esTotal) continue;

    const montos = lineaOriginal.match(/\$?\s*\d{1,6}[.,]\d{2}/g);

    if (montos && montos.length) {
      return normalizarMonto(montos[montos.length - 1]).toFixed(2);
    }

    // Si el monto viene en la siguiente línea
    const siguiente = lineas[i + 1] || "";
    const montoSiguiente = siguiente.match(/\$?\s*\d{1,6}[.,]\d{2}/);

    if (montoSiguiente) {
      return normalizarMonto(montoSiguiente[0]).toFixed(2);
    }
  }

  // Fallback: buscar el primer TOTAL antes de VISA/PROPINA
  const textoCompleto = lineas.join("\n").toUpperCase();

  const zona = textoCompleto.match(/T\s*O\s*T\s*A\s*L[\s\S]{0,40}?(\d{1,6}[.,]\d{2})/i);

  if (zona && zona[1]) {
    return normalizarMonto(zona[1]).toFixed(2);
  }

  return "";
}

async function analizarTicketOCR(file) {
  if (!file) throw new Error("No hay imagen.");

  const imagenProcesada = await prepararImagenOCR(file);

  const result = await Tesseract.recognize(imagenProcesada, "spa+eng", {
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
  console.log("RESULTADO OCR:", { folio, fecha, total });

  return { folio, fecha, total };
}
