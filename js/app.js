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
