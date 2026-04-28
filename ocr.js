// ocr.js
function limpiarTextoOCR(texto) {
  return texto
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/T0TAL/gi, "TOTAL")
    .replace(/TOTAI/gi, "TOTAL")
    .replace(/TOTL/gi, "TOTAL")
    .replace(/PROPINA/gi, "PROPINA")
    .replace(/\s+/g, " ")
    .trim();
}

function extraerFolio(texto) {
  const limpio = texto.toUpperCase();

  // 🔥 PRIORIDAD: buscar cerca de "Reimpresion No"
  let match = limpio.match(/REIMPRESION\s*NO\s*[:.]?\s*(\d{1,3}).*?(\d{5})/);
  if (match && match[2]) return match[2];

  // 🔥 buscar número de 5 dígitos cerca de hora
  match = limpio.match(/\d{1,2}:\d{2}.*?(\d{5})/);
  if (match && match[1]) return match[1];

  // fallback
  match = limpio.match(/\b(\d{5})\b/);
  if (match) return match[1];

  return "";
}

function extraerFecha(texto) {
  const match = texto.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";

  const dd = match[1];
  const mm = match[2];
  const yyyy = match[3];

  return `${yyyy}-${mm}-${dd}`;
}

function extraerTotal(texto) {
  const limpio = texto.toUpperCase();

  const lineas = limpio.split("\n").map(l => l.trim());

  // 🔥 PASO 1: buscar SOLO líneas que empiezan con "TOTAL"
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];

    // SOLO "TOTAL" exacto
    if (linea.startsWith("TOTAL")) {

      // ❌ ignorar si contiene propina
      if (linea.includes("PROPINA")) continue;

      const match = linea.match(/\d+[.,]\d{2}/);

      if (match) {
        return normalizarMonto(match[0]).toFixed(2);
      }

      // 🔥 si el número está en la siguiente línea
      const siguiente = lineas[i + 1] || "";
      const match2 = siguiente.match(/\d+[.,]\d{2}/);

      if (match2) {
        return normalizarMonto(match2[0]).toFixed(2);
      }
    }
  }

  return "";
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
