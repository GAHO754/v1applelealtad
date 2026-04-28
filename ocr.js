// ocr.js

function limpiarTextoOCR(texto) {
  return texto
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/S/g, "S")
    .replace(/O/g, "0")
    .replace(/TOTAL\s*:/gi, "TOTAL ")
    .replace(/T0TAL/gi, "TOTAL")
    .replace(/IMPORTE/gi, "TOTAL")
    .replace(/PAGADO/gi, "TOTAL")
    .replace(/FECHA\s*:/gi, "FECHA ")
    .replace(/\s+/g, " ")
    .trim();
}

function extraerFolio(texto) {
  const limpio = texto.toUpperCase();

  const patrones = [
    /FOLIO\s*[:#]?\s*(\d{5})/,
    /TICKET\s*[:#]?\s*(\d{5})/,
    /NO\.?\s*TICKET\s*[:#]?\s*(\d{5})/,
    /NUM\.?\s*TICKET\s*[:#]?\s*(\d{5})/,
    /\b(\d{5})\b/
  ];

  for (const p of patrones) {
    const match = limpio.match(p);
    if (match && match[1]) {
      const folio = match[1];

      if (folio !== "32530") {
        return folio;
      }
    }
  }

  return "";
}

function extraerFecha(texto) {
  const limpio = texto.toUpperCase();

  const patrones = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/
  ];

  for (const p of patrones) {
    const match = limpio.match(p);

    if (!match) continue;

    if (match[1].length === 4) {
      const yyyy = match[1];
      const mm = match[2];
      const dd = match[3];
      return `${yyyy}-${mm}-${dd}`;
    } else {
      const dd = match[1];
      const mm = match[2];
      const yyyy = match[3];
      return `${yyyy}-${mm}-${dd}`;
    }
  }

  return "";
}

function extraerTotal(texto) {
  const limpio = texto.toUpperCase();

  const lineas = limpio
    .split(/[\n]/)
    .map(l => l.trim())
    .filter(Boolean);

  const candidatos = [];

  for (const linea of lineas) {
    if (
      linea.includes("TOTAL") ||
      linea.includes("IMPORTE") ||
      linea.includes("PAGADO")
    ) {
      const nums = linea.match(/\d+[.,]\d{2}/g);
      if (nums) {
        nums.forEach(n => candidatos.push(n));
      }
    }
  }

  if (candidatos.length > 0) {
    return normalizarMonto(candidatos[candidatos.length - 1]);
  }

  const todos = limpio.match(/\d+[.,]\d{2}/g);

  if (!todos || todos.length === 0) {
    return "";
  }

  const montos = todos.map(normalizarMonto).filter(n => n > 0);

  if (!montos.length) return "";

  return Math.max(...montos).toFixed(2);
}

function normalizarMonto(valor) {
  if (!valor) return 0;

  return Number(
    String(valor)
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
  );
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
  const texto = limpiarTextoOCR(textoOriginal);

  const folio = extraerFolio(texto);
  const fecha = extraerFecha(textoOriginal);
  const total = extraerTotal(textoOriginal);

  console.log("===== OCR ORIGINAL =====");
  console.log(textoOriginal);
  console.log("===== OCR LIMPIO =====");
  console.log(texto);
  console.log({ folio, fecha, total });

  return {
    folio,
    fecha,
    total
  };
}