const observer = new IntersectionObserver(
  (entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.classList.add("visible")),
  { threshold: 0.08 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

const filterButtons = document.querySelectorAll("[data-filter]");
const missionEntries = document.querySelectorAll("[data-category]");

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    missionEntries.forEach((entry) => {
      entry.hidden = filter !== "todas" && entry.dataset.category !== filter;
    });
  });
});

const dialog = document.querySelector("[data-dialog]");
const dialogTitle = document.querySelector("[data-dialog-title]");

document.querySelectorAll("[data-mission]").forEach((button) => {
  button.addEventListener("click", () => {
    dialogTitle.textContent = button.dataset.mission;
    dialog?.showModal();
  });
});

document.querySelector(".dialog-close")?.addEventListener("click", () => dialog?.close());
dialog?.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

const recommendations = {
  vida: "NQ—02 / OCÉANO OCULTO: investiga Europa y las condiciones de su océano.",
  geologia: "NQ—01 / CRÓNICAS DE MARTE: sigue las huellas del agua y los volcanes.",
  atmosfera: "NQ—04 / NUBES DE VENUS: compara climas y atmósferas extremas."
};

document.querySelector("[data-selector]")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const shortMode = form.elements.time.value === "breve" ? " / MODO BREVE DISPONIBLE" : "";
  form.querySelector("output").textContent = recommendations[form.elements.interest.value] + shortMode;
});

// PWA COMPARTIDA / APORTACIÓN KEVIN:
// Conserva el evento de instalación para mostrar un botón propio cuando
// Chrome/Edge determine que la PWA cumple los requisitos de instalación.
let deferredInstallPrompt = null;
const installHelp = document.querySelector("[data-install-help]");
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia("(display-mode: standalone)").matches
  || navigator.standalone === true;

if (isIos && !isStandalone) {
  document.querySelectorAll("[data-install-app]").forEach((button) => {
    button.hidden = false;
    button.textContent = "Instalar en iPhone";
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelectorAll("[data-install-app]").forEach((button) => {
    button.hidden = false;
  });
});

document.querySelectorAll("[data-install-app]").forEach((button) => {
  button.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      installHelp?.showModal();
      return;
    }
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    button.hidden = true;
  });
});

document.querySelector("[data-install-help-close]")?.addEventListener("click", () => installHelp?.close());
installHelp?.addEventListener("click", (event) => {
  if (event.target === installHelp) installHelp.close();
});
