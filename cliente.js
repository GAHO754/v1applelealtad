// cliente.js PRO FINAL 🔥

const PERCENT_BACK = 0.05;
const VENCE_DIAS = 180;
const DAY_LIMIT_TICKETS = 3;
const BONUS_EXTRA = 5;

let ticketOCRValido = false;

// ================= UTILIDADES =================

function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ================= LOGIN =================

async function loginCliente() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Ingresa correo y contraseña.");
    return;
  }

  try {
    await auth.signInWithEmailAndPassword(email, password);
    window.location.href = "panel.html";
  } catch (error) {
    alert("Error: " + error.message);
  }
}

// ================= ESCANEO =================

function previewTicket(event) {
  const file = event.target.files[0];
  if (!file) return;

  ticketOCRValido = false;

  document.getElementById("folio").value = "";
  document.getElementById("fechaTicket").value = "";
  document.getElementById("totalTicket").value = "";
  document.getElementById("btnRegistrarTicket").disabled = true;

  const preview = document.getElementById("previewImage");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";

  document.getElementById("ocrStatus").innerText =
    "Imagen cargada. Presiona Analizar ticket.";
}

async function procesarTicketOCR() {
  const input = document.getElementById("ticketImage");
  const status = document.getElementById("ocrStatus");
  const btn = document.getElementById("btnRegistrarTicket");

  ticketOCRValido = false;
  btn.disabled = true;

  if (!input.files.length) {
    alert("Toma una foto primero.");
    return;
  }

  try {
    status.innerText = "Analizando ticket...";

    const { folio, fecha, total } = await analizarTicketOCR(input.files[0]);

    document.getElementById("folio").value = folio;
    document.getElementById("fechaTicket").value = fecha;
    document.getElementById("totalTicket").value = total;

    if (!folio || !fecha || !total) {
      console.log("DEBUG OCR:", { folio, fecha, total });

      status.innerText = `No detectado →
      Folio: ${folio || "❌"}
      Fecha: ${fecha || "❌"}
      Total: ${total || "❌"}`;

      alert("No se detectaron todos los datos.");
      return;
    }

    ticketOCRValido = true;
    btn.disabled = false;

    status.innerText = "Ticket listo para registrar.";
  } catch (err) {
    console.error(err);
    alert("Error OCR");
  }
}

function reiniciarEscaneoTicket() {
  ticketOCRValido = false;

  document.getElementById("ticketImage").value = "";
  document.getElementById("previewImage").style.display = "none";

  document.getElementById("folio").value = "";
  document.getElementById("fechaTicket").value = "";
  document.getElementById("totalTicket").value = "";

  document.getElementById("btnRegistrarTicket").disabled = true;
}

// ================= REGISTRO =================

async function registrarTicketCliente() {
  const user = auth.currentUser;
  if (!user) return;

  if (!ticketOCRValido) {
    alert("Primero debes analizar correctamente el ticket con OCR.");
    return;
  }

  const sucursal = document.getElementById("sucursal").value;
  const folio = document.getElementById("folio").value.trim();
  const fechaTicket = document.getElementById("fechaTicket").value;
  const total = Number(document.getElementById("totalTicket").value);
  const btn = document.getElementById("btnRegistrarTicket");

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Registrando...";
  }

  try {
    if (!sucursal || !folio || !fechaTicket || !total) {
      throw new Error("FALTAN_DATOS");
    }

    const ticketKey = `${sucursal}_${fechaTicket}_${folio}`;
    const ticketRef = db.collection("tickets").doc(ticketKey);
    const userRef = db.collection("users").doc(user.uid);

    const ticketDoc = await ticketRef.get();

    if (ticketDoc.exists) {
      throw new Error("DUPLICADO");
    }

    const ticketsDiaSnap = await db.collection("tickets")
      .where("userId", "==", user.uid)
      .where("fechaTicket", "==", fechaTicket)
      .get();

    if (ticketsDiaSnap.size >= 3) {
      throw new Error("LIMITE_DIA");
    }

    const monederoBase = Number((total * PERCENT_BACK).toFixed(2));
    const bonoExtra = Math.random() < 0.25 ? 5 : 0;
    const monederoGenerado = Number((monederoBase + bonoExtra).toFixed(2));
    const venceAt = addDays(fechaTicket, VENCE_DIAS);

    const movementRef = db.collection("walletMovements").doc();

    await ticketRef.set({
      ticketKey,
      userId: user.uid,
      clienteEmail: user.email,
      sucursal,
      folio,
      fechaTicket,
      total,
      porcentajeMonedero: PERCENT_BACK,
      monederoBase,
      bonoExtra,
      monederoGenerado,
      venceAt,
      status: "registrado",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await movementRef.set({
      userId: user.uid,
      tipo: "abono",
      concepto: bonoExtra > 0
        ? "Registro de ticket + bono sorpresa"
        : "Registro de ticket",
      ticketKey,
      monto: monederoGenerado,
      monederoBase,
      bonoExtra,
      venceAt,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await userRef.update({
      saldoDisponible: firebase.firestore.FieldValue.increment(monederoGenerado),
      totalGastado: firebase.firestore.FieldValue.increment(total),
      ticketsRegistrados: firebase.firestore.FieldValue.increment(1)
    });

    if (bonoExtra > 0) {
      alert(
        `🎉 Ticket registrado correctamente.\n\n` +
        `Ganaste ${money(monederoBase)} de dinero electrónico.\n` +
        `Además recibiste ${money(bonoExtra)} extra por ser cliente fiel.\n\n` +
        `Total agregado: ${money(monederoGenerado)}\n\n` +
        `¡Te esperamos en tu próxima visita!`
      );
    } else {
      alert(
        `✅ Ticket registrado correctamente.\n\n` +
        `Ganaste ${money(monederoBase)} de dinero electrónico.\n\n` +
        `¡Te esperamos en tu próxima visita!`
      );
    }

    window.location.href = "panel.html";

  } catch (error) {
    console.error("ERROR REAL AL REGISTRAR:", error);
    console.error("CODE:", error.code);
    console.error("MESSAGE:", error.message);

    if (error.message === "DUPLICADO") {
      alert("Este ticket ya fue registrado para esta fecha.");
    } else if (error.message === "LIMITE_DIA") {
      alert("Ya alcanzaste el límite de 3 tickets registrados por día.");
    } else if (error.message === "FALTAN_DATOS") {
      alert("Faltan datos del ticket.");
    } else {
      alert(
        "No se pudo registrar el ticket.\n\n" +
        "Código: " + (error.code || "sin código") + "\n" +
        "Mensaje: " + (error.message || "sin mensaje")
      );
    }

    if (btn) {
      btn.disabled = false;
      btn.innerText = "Registrar ticket";
    }
  }
}
