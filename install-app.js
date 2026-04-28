let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const btn = document.getElementById("installAppBtn");
  if (btn) btn.style.display = "flex";
});

async function instalarApp() {
  const btn = document.getElementById("installAppBtn");

  if (!deferredPrompt) {
    alert("En iPhone: abre Safari, toca Compartir y selecciona Agregar a pantalla de inicio.");
    return;
  }

  deferredPrompt.prompt();

  const choice = await deferredPrompt.userChoice;

  if (choice.outcome === "accepted") {
    if (btn) btn.style.display = "none";
  }

  deferredPrompt = null;
}

window.addEventListener("appinstalled", () => {
  const btn = document.getElementById("installAppBtn");
  if (btn) btn.style.display = "none";
});