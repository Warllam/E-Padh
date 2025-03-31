// public/js/admin.js
const socket = io();

// Sélecteurs pour l’état des displays
const display1StateEl = document.getElementById("display1State");
const display2StateEl = document.getElementById("display2State");

// Sélecteur pour forcer l'affichage sur Display 1 ou 2
const forcePlayerSelect = document.getElementById("forcePlayerSelect");

// Éléments pour la gestion des équipes
const addTeamForm = document.getElementById("addTeamForm");
const teamNameInput = document.getElementById("teamName");
const teamJ1Input = document.getElementById("teamJ1");
const teamJ2Input = document.getElementById("teamJ2");
const addTeamMessage = document.getElementById("addTeamMessage");
const teamsList = document.getElementById("teamsList");

// Empêcher les espaces dans le champ “Nom de l’équipe”
teamNameInput.addEventListener("input", () => {
  teamNameInput.value = teamNameInput.value.replace(/\s+/g, "");
});

/**
 * Fonction pour slugifier l'identifiant d'équipe :
 * - Supprime les accents (normalize)
 * - Met en minuscule
 * - Retire tout caractère non alphanumérique
 */
function slugifyTeamName(name) {
  return name
    .normalize("NFD") // décompose accents
    .replace(/[\u0300-\u036f]/g, "") // supprime accents
    .replace(/[^a-zA-Z0-9]/g, "") // enlève tout ce qui n'est pas a-z ou 0-9
    .toLowerCase();
}

// État local de ce qui est diffusé
let displayState = { 1: null, 2: null };

/* -----------------------------------------------------------
   1. Envoi manuel via le sélecteur “forcePlayerSelect”
----------------------------------------------------------- */
document.querySelectorAll(".displayBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const pseudo = forcePlayerSelect.value;
    const displayId = btn.dataset.display;
    socket.emit("display-pov", { pseudo, displayId });
  });
});

/* -----------------------------------------------------------
   2. Réception de l'état des displays par socket
----------------------------------------------------------- */
// Le serveur nous envoie "update-display" quand un display change
socket.on("update-display", (newDisplayState) => {
  displayState = newDisplayState;
  renderDisplayState();
});

function renderDisplayState() {
  display1StateEl.textContent = displayState["1"] || "Aucun";
  display2StateEl.textContent = displayState["2"] || "Aucun";
}

// Reset d’un display
document.querySelectorAll(".resetBtn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const displayId = btn.dataset.reset;
    socket.emit("reset-pov", displayId);
  });
});

/* -----------------------------------------------------------
   3. Gestion des équipes (CRUD)
----------------------------------------------------------- */

function loadTeams() {
  fetch("/api/teams")
    .then((res) => res.json())
    .then((data) => {
      const { teams } = data;
      renderTeams(teams);
    })
    .catch((err) => {
      console.error("Erreur loadTeams:", err);
      teamsList.innerHTML = "<li>Erreur de chargement</li>";
    });
}

function renderTeams(teams) {
  teamsList.innerHTML = "";
  // teams est un objet { key: { nom_equipe, nom_j1, nom_j2 } }
  Object.keys(teams).forEach((key) => {
    const t = teams[key];
    const li = document.createElement("li");
    li.textContent = `${t.nom_equipe} (${key}) : ${t.nom_j1}, ${t.nom_j2}`;

    // Bouton "Supprimer"
    const delBtn = document.createElement("button");
    delBtn.textContent = "Supprimer";
    delBtn.classList.add(
      "ml-4",
      "bg-red-500",
      "text-white",
      "px-2",
      "py-1",
      "rounded"
    );
    delBtn.addEventListener("click", () => {
      if (confirm("Supprimer cette équipe ?")) {
        deleteTeam(key);
      }
    });

    li.appendChild(delBtn);
    teamsList.appendChild(li);
  });
}

function deleteTeam(key) {
  fetch(`/api/teams/${key}`, { method: "DELETE" })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        alert(data.error);
      } else {
        loadTeams();
      }
    })
    .catch((err) => {
      console.error(err);
    });
}

// Formulaire d'ajout d'équipe
addTeamForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const rawName = teamNameInput.value.trim();
  const newKey = slugifyTeamName(rawName);

  const newTeam = {
    key: newKey,
    nom_equipe: rawName, // Conserve le nom original
    nom_j1: teamJ1Input.value.trim(),
    nom_j2: teamJ2Input.value.trim(),
  };

  fetch("/api/teams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newTeam),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) {
        addTeamMessage.textContent = "Erreur: " + data.error;
        addTeamMessage.style.color = "red";
      } else {
        addTeamMessage.textContent = data.message || "Équipe ajoutée !";
        addTeamMessage.style.color = "green";
        loadTeams();
        // Remettre le formulaire à zéro
        teamNameInput.value = "";
        teamJ1Input.value = "";
        teamJ2Input.value = "";
      }
    })
    .catch((err) => {
      console.error(err);
      addTeamMessage.textContent = "Erreur lors de l'ajout";
      addTeamMessage.style.color = "red";
    });
});

/* -----------------------------------------------------------
   4. Initialisation
----------------------------------------------------------- */
loadTeams();
// On laisse "renderDisplayState()" vide si le serveur n'a pas encore
// émis "update-display"; sinon, ce sera mis à jour dès la 1re emission.
