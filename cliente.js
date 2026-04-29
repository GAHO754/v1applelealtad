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
    alert("Primero analiza el ticket.");
    return;
  }

  const sucursal = document.getElementById("sucursal").value;
  const folio = document.getElementById("folio").value.trim();
  const fechaTicket = document.getElementById("fechaTicket").value;
  const total = Number(document.getElementById("totalTicket").value);

  if (!sucursal) {
    alert("Selecciona sucursal.");
    return;
  }

  const ticketKey = `${sucursal}_${fechaTicket}_${folio}`;
  const ticketRef = db.collection("tickets").doc(ticketKey);

  try {
    // 🔥 LIMITE 3 POR DIA
    const snap = await db.collection("tickets")
      .where("userId", "==", user.uid)
      .where("fechaTicket", "==", fechaTicket)
      .get();

    if (snap.size >= DAY_LIMIT_TICKETS) {
      alert("Máximo 3 tickets por día.");
      return;
    }

    const doc = await ticketRef.get();
    if (doc.exists) {
      alert("Ticket duplicado.");
      return;
    }

    const base = Number((total * PERCENT_BACK).toFixed(2));

    const bonus = Math.random() < 0.3 ? BONUS_EXTRA : 0;
    const totalFinal = base + bonus;

    await db.runTransaction(async (t) => {
      const userRef = db.collection("users").doc(user.uid);

      t.set(ticketRef, {
        userId: user.uid,
        sucursal,
        folio,
        fechaTicket,
        total,
        monedero: totalFinal,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      t.update(userRef, {
        saldoDisponible: firebase.firestore.FieldValue.increment(totalFinal),
        ticketsRegistrados: firebase.firestore.FieldValue.increment(1)
      });
    });

    if (bonus > 0) {
      alert(`🎉 Ticket registrado
Ganaste ${money(base)} + ${money(bonus)} extra`);
    } else {
      alert(`✅ Ticket registrado
Ganaste ${money(base)}`);
    }

    window.location.href = "panel.html";

  } catch (error) {
    console.error(error);
    alert("Error registrando ticket.");
  }
}
