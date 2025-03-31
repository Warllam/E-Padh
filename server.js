// server.js
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");
const fs = require("fs");

// On importe la fonction Puppeteer pour la route /api/vdo-ninja-pov
const { scrapeDirectorPagePuppeteer } = require("./scraper");

// ------------------------------
// CONFIG : fichier JSON des équipes
// ------------------------------
const TEAMS_FILE = path.join(__dirname, "teams.json");

// ---------------------------------------------------------------
// Helpers pour charger / sauvegarder le JSON des équipes
// ---------------------------------------------------------------
function loadTeams() {
  const data = fs.readFileSync(TEAMS_FILE, "utf-8");
  return JSON.parse(data);
}

function saveTeams(teamsData) {
  fs.writeFileSync(TEAMS_FILE, JSON.stringify(teamsData, null, 2), "utf-8");
}

let teamsData = loadTeams();

// Fonction pour extraire tous les pseudos uniques
function getAllPlayers() {
  let allPlayers = [];
  Object.values(teamsData).forEach((team) => {
    if (team.nom_j1) allPlayers.push(team.nom_j1);
    if (team.nom_j2) allPlayers.push(team.nom_j2);
  });
  // Supprimer doublons + trier
  allPlayers = [...new Set(allPlayers)].sort();
  return allPlayers;
}

// ---------------------------------------------------------------
// Création Serveur Express + Socket.IO
// ---------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json()); // pour lire le body JSON
// Sert les fichiers statiques depuis le dossier "public"
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------------------------------------------
// ROUTES D'API
// ---------------------------------------------------------------

// 1) Récupérer toutes les équipes
app.get("/api/teams", (req, res) => {
  res.json({ teams: teamsData });
});

// 2) Récupérer la liste de tous les pseudos
app.get("/api/players", (req, res) => {
  const players = getAllPlayers();
  res.json({ players });
});

// 3) Ajouter une équipe (POST)
app.post("/api/teams", (req, res) => {
  const { key, nom_equipe, nom_j1, nom_j2 } = req.body;
  if (!key || !nom_equipe) {
    return res
      .status(400)
      .json({ error: "Champs 'key' et 'nom_equipe' obligatoires" });
  }
  if (teamsData[key]) {
    return res.status(409).json({ error: "Cette clé d’équipe existe déjà." });
  }
  teamsData[key] = {
    nom_equipe,
    nom_j1: nom_j1 || "",
    nom_j2: nom_j2 || "",
  };
  saveTeams(teamsData);
  res.json({ message: "Équipe ajoutée avec succès", teams: teamsData });
});

// 4) Supprimer une équipe (DELETE)
app.delete("/api/teams/:key", (req, res) => {
  const teamKey = req.params.key;
  if (!teamsData[teamKey]) {
    return res.status(404).json({ error: "Clé d’équipe introuvable" });
  }
  delete teamsData[teamKey];
  saveTeams(teamsData);
  res.json({ message: "Équipe supprimée", teams: teamsData });
});

// 5) Route GET /api/vdo-ninja-pov (ex: via Puppeteer)
app.get("/api/vdo-ninja-pov", async (req, res) => {
  const result = await scrapeDirectorPagePuppeteer();
  if (!result.success) {
    return res.status(500).json(result);
  }
  // Transfo "sids" en "activePovs"
  res.json({
    success: true,
    activePovs: result.sids.map((sid) => ({
      sid,
      label: sid, // ou un label plus pertinent
    })),
  });
});

// ---------------------------------------------------------------
// SOCKET.IO
// ---------------------------------------------------------------

// On garde un objet local pour savoir qui partage
let currentlySharing = {}; // { pseudo: true, ... }

// On maintient aussi un état global pour "Display 1" et "Display 2"
let displayState = { 1: null, 2: null };

io.on("connection", (socket) => {
  console.log("Nouveau client connecté:", socket.id);

  // Envoyer l'état actuel du display dès la connexion
  socket.emit("update-display", displayState);

  // Quand un joueur commence sa diffusion
  socket.on("start-share", (pseudo) => {
    currentlySharing[pseudo] = true;
    console.log(`start-share: ${pseudo}`);
    io.emit("update-sharing", currentlySharing);
  });

  // Quand un joueur arrête la diffusion
  socket.on("stop-share", (pseudo) => {
    currentlySharing[pseudo] = false;
    console.log(`stop-share: ${pseudo}`);
    io.emit("update-sharing", currentlySharing);
  });

  // Quand l'admin demande d'afficher un pseudo sur display1 ou 2
  socket.on("display-pov", ({ pseudo, displayId }) => {
    displayState[displayId] = pseudo;
    io.emit("update-display", displayState);
  });

  // Quand l'admin reset un display
  socket.on("reset-pov", (displayId) => {
    displayState[displayId] = null;
    io.emit("update-display", displayState);
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté:", socket.id);
  });
});

// ---------------------------------------------------------------
// Lancement du serveur
// ---------------------------------------------------------------
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
