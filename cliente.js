// cliente.js

const PERCENT_BACK = 0.05;
const VENCE_DIAS = 180;

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

function go(page) {
  window.location.href = page;
}

function cerrarSesion() {
  auth.signOut().then(() => {
    window.location.href = "login.html";
  });
}

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
    alert("Error al iniciar sesión: " + error.message);
  }
}

async function registrarCliente() {
  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!nombre || !telefono || !email || !password) {
    alert("Completa todos los campos.");
    return;
  }

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);

    await db.collection("users").doc(cred.user.uid).set({
      nombre,
      telefono,
      email,
      role: "cliente",
      saldoDisponible: 0,
      totalGastado: 0,
      ticketsRegistrados: 0,
      canjesRealizados: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    window.location.href = "panel.html";
  } catch (error) {
    alert("Error al crear cuenta: " + error.message);
  }
}

auth.onAuthStateChanged(async (user) => {
  const page = location.pathname.split("/").pop();

  const publicPages = ["login.html", "registro.html", ""];
  if (!user && !publicPages.includes(page)) {
    window.location.href = "login.html";
    return;
  }

  if (user && publicPages.includes(page)) {
    return;
  }

  if (user) {
    await cargarDatosCliente(user);
  }
});

async function cargarDatosCliente(user) {
  const userRef = db.collection("users").doc(user.uid);
  const doc = await userRef.get();

  if (!doc.exists) return;

  const data = doc.data();

  if (document.getElementById("nombreCliente")) {
    document.getElementById("nombreCliente").innerText = data.nombre || "Cliente";
  }

  if (document.getElementById("saldoCliente")) {
    document.getElementById("saldoCliente").innerText = money(data.saldoDisponible);
  }

  if (document.getElementById("saldoMonedero")) {
    document.getElementById("saldoMonedero").innerText = money(data.saldoDisponible);
  }

  if (document.getElementById("saldoCanje")) {
    document.getElementById("saldoCanje").innerText = money(data.saldoDisponible);
  }

  if (document.getElementById("totalGastado")) {
    document.getElementById("totalGastado").innerText = money(data.totalGastado);
  }

  if (document.getElementById("ticketsRegistrados")) {
    document.getElementById("ticketsRegistrados").innerText = data.ticketsRegistrados || 0;
  }

  if (document.getElementById("canjesRealizados")) {
    document.getElementById("canjesRealizados").innerText = data.canjesRealizados || 0;
  }

  if (document.getElementById("listaMovimientos")) {
    cargarMovimientos(user.uid);
  }

  if (document.getElementById("historialLista")) {
    mostrarHistorial("tickets");
  }
}

function previewTicket(event) {
  const file = event.target.files[0];
  if (!file) return;

  const preview = document.getElementById("previewImage");
  preview.src = URL.createObjectURL(file);
  preview.style.display = "block";

  const status = document.getElementById("ocrStatus");
  if (status) status.innerText = "Imagen cargada. Presiona Analizar ticket.";
}

async function procesarTicketOCR() {
  const input = document.getElementById("ticketImage");
  const status = document.getElementById("ocrStatus");

  if (!input.files.length) {
    alert("Primero toma o selecciona una foto del ticket.");
    return;
  }

  try {
    status.innerText = "Analizando ticket...";

    const result = await analizarTicketOCR(input.files[0]);

    if (result.folio) document.getElementById("folio").value = result.folio;
    if (result.fecha) document.getElementById("fechaTicket").value = result.fecha;
    if (result.total) document.getElementById("totalTicket").value = result.total;

    status.innerText = "Ticket analizado. Revisa los datos antes de registrar.";
  } catch (error) {
    status.innerText = "No se pudo leer el ticket. Puedes capturar los datos manualmente.";
    console.error(error);
  }
}

async function registrarTicketCliente() {
  const user = auth.currentUser;
  if (!user) return;

  const sucursal = document.getElementById("sucursal").value;
  const folio = document.getElementById("folio").value.trim();
  const fechaTicket = document.getElementById("fechaTicket").value;
  const total = Number(document.getElementById("totalTicket").value);

  if (!sucursal || !folio || !fechaTicket || !total) {
    alert("Completa sucursal, folio, fecha e importe.");
    return;
  }

  if (!/^\d{5}$/.test(folio)) {
    alert("El número de ticket debe tener exactamente 5 dígitos.");
    return;
  }

  if (fechaTicket > todayISO()) {
    alert("La fecha del ticket no puede ser futura.");
    return;
  }

  if (total <= 0) {
    alert("El importe debe ser mayor a 0.");
    return;
  }

  const ticketKey = `${sucursal}_${fechaTicket}_${folio}`;
  const ticketRef = db.collection("tickets").doc(ticketKey);
  const ticketDoc = await ticketRef.get();

  if (ticketDoc.exists) {
    alert("Este ticket ya fue registrado para esta fecha.");
    return;
  }

  const monedero = Number((total * PERCENT_BACK).toFixed(2));
  const venceAt = addDays(fechaTicket, VENCE_DIAS);

  try {
    await db.runTransaction(async (transaction) => {
      const checkDoc = await transaction.get(ticketRef);

      if (checkDoc.exists) {
        throw new Error("DUPLICADO");
      }

      const userRef = db.collection("users").doc(user.uid);
      const movementRef = db.collection("walletMovements").doc();

      transaction.set(ticketRef, {
        ticketKey,
        userId: user.uid,
        sucursal,
        folio,
        fechaTicket,
        total,
        monederoGenerado: monedero,
        venceAt,
        status: "registrado",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      transaction.set(movementRef, {
        userId: user.uid,
        tipo: "abono",
        concepto: "Registro de ticket",
        ticketKey,
        monto: monedero,
        venceAt,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(userRef, {
        saldoDisponible: firebase.firestore.FieldValue.increment(monedero),
        totalGastado: firebase.firestore.FieldValue.increment(total),
        ticketsRegistrados: firebase.firestore.FieldValue.increment(1)
      });
    });

    alert("Ticket registrado correctamente.");
    window.location.href = "panel.html";
  } catch (error) {
    if (error.message === "DUPLICADO") {
      alert("Este ticket ya fue registrado.");
    } else {
      console.error(error);
      alert("Error al registrar ticket.");
    }
  }
}

async function cargarMovimientos(userId) {
  const cont = document.getElementById("listaMovimientos");
  if (!cont) return;

  const snap = await db.collection("walletMovements")
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(20)
    .get();

  if (snap.empty) {
    cont.innerHTML = "Sin movimientos todavía.";
    return;
  }

  cont.innerHTML = "";

  snap.forEach(doc => {
    const m = doc.data();
    cont.innerHTML += `
      <div class="history-item">
        <strong>${m.concepto || m.tipo}</strong>
        <span>${money(m.monto)}</span>
      </div>
    `;
  });
}

async function generarCanjeCliente(beneficio, monto) {
  const user = auth.currentUser;
  if (!user) return;

  const userRef = db.collection("users").doc(user.uid);
  const userDoc = await userRef.get();
  const data = userDoc.data();

  const saldo = Number(data.saldoDisponible || 0);

  if (saldo < monto) {
    alert("Saldo insuficiente para este canje.");
    return;
  }

  const redemptionRef = db.collection("redemptions").doc();
  const movementRef = db.collection("walletMovements").doc();

  try {
    await db.runTransaction(async (transaction) => {
      const freshUser = await transaction.get(userRef);
      const saldoActual = Number(freshUser.data().saldoDisponible || 0);

      if (saldoActual < monto) {
        throw new Error("SALDO_INSUFICIENTE");
      }

      transaction.set(redemptionRef, {
        redemptionId: redemptionRef.id,
        userId: user.uid,
        clienteEmail: user.email,
        beneficio,
        monto,
        status: "pendiente",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        redeemedAt: null,
        sucursalCanje: null,
        gerenteEmail: null
      });

      transaction.set(movementRef, {
        userId: user.uid,
        tipo: "canje_pendiente",
        concepto: beneficio,
        redemptionId: redemptionRef.id,
        monto: -monto,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      transaction.update(userRef, {
        saldoDisponible: firebase.firestore.FieldValue.increment(-monto)
      });
    });

    document.getElementById("qrSection").style.display = "block";
    document.getElementById("qrCode").innerHTML = "";

    new QRCode(document.getElementById("qrCode"), {
      text: redemptionRef.id,
      width: 220,
      height: 220
    });

    alert("QR generado correctamente.");
  } catch (error) {
    console.error(error);
    alert("No se pudo generar el canje.");
  }
}

async function mostrarHistorial(tipo) {
  const user = auth.currentUser;
  if (!user) return;

  const titulo = document.getElementById("historialTitulo");
  const lista = document.getElementById("historialLista");

  if (!lista) return;

  lista.innerHTML = "Cargando...";

  if (tipo === "tickets") {
    titulo.innerText = "Tickets registrados";

    const snap = await db.collection("tickets")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    if (snap.empty) {
      lista.innerHTML = "No tienes tickets registrados.";
      return;
    }

    lista.innerHTML = "";

    snap.forEach(doc => {
      const t = doc.data();

      lista.innerHTML += `
        <div class="history-item">
          <div>
            <strong>Ticket ${t.folio}</strong>
            <p>${t.fechaTicket} · ${t.sucursal}</p>
          </div>
          <span>${money(t.total)}</span>
        </div>
      `;
    });
  }

  if (tipo === "canjes") {
    titulo.innerText = "Canjes realizados";

    const snap = await db.collection("redemptions")
      .where("userId", "==", user.uid)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    if (snap.empty) {
      lista.innerHTML = "No tienes canjes registrados.";
      return;
    }

    lista.innerHTML = "";

    snap.forEach(doc => {
      const r = doc.data();

      lista.innerHTML += `
        <div class="history-item">
          <div>
            <strong>${r.beneficio}</strong>
            <p>Estado: ${r.status}</p>
          </div>
          <span>${money(r.monto)}</span>
        </div>
      `;
    });
  }
}