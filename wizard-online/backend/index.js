// backend/index.js

const { createDeck, dealCards, determineCardsPerPlayer } = require('./utils/deck');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // Frontend URL
    methods: ["GET", "POST"]
  }
});

app.use(cors());

const games = {};

io.on('connection', (socket) => {
  console.log('Ein Benutzer ist verbunden:', socket.id);

  // Listener für 'spielZug'
  socket.on('spielZug', ({ gameId, card }) => {
    console.log('Spielzug erhalten:', { gameId, card });
    const game = games[gameId];
    if (!game) {
      console.log(`Spiel mit ID ${gameId} existiert nicht.`);
      return;
    }

    const player = game.players.find(p => p.id === socket.id);
    if (!player) {
      console.log(`Spieler mit ID ${socket.id} ist nicht im Spiel.`);
      return;
    }

    // Entferne die gespielte Karte aus der Hand des Spielers
    player.hand = player.hand.filter(c => !(c.rank === card.rank && c.suit === card.suit));

    // Füge die Karte zum aktuellen Stich hinzu
    game.currentStich = game.currentStich || [];
    game.currentStich.push({ playerId: socket.id, card });

    // Prüfe, ob der Stich abgeschlossen ist (z.B. alle Spieler haben eine Karte gespielt)
    if (game.currentStich.length === game.players.length) {
      // Bestimme den Gewinner des Stiches
      const winner = determineStichGewinner(game.currentStich);
      // Aktualisiere den Spielstand
      updateScores(game, winner);
      // Informiere alle Spieler über den Stich
      io.to(gameId).emit('stichAbgeschlossen', { winner, stich: game.currentStich });
      // Bereite den nächsten Stich vor
      game.currentStich = [];
    } else {
      // Informiere die Spieler, dass der nächste Spieler am Zug ist
      io.to(gameId).emit('naechsterSpieler', { spielerId: getNextPlayerId(game, socket.id) });
    }
  });

  // Listener für 'startGame'
  socket.on('startGame', ({ gameId }) => {
    console.log("START EMPFANGEN für Spiel:", gameId);
    const game = games[gameId];
    if (!game) {
      console.log(`Spiel mit ID ${gameId} existiert nicht.`);
      return;
    }

    if (game.players.length < 2) { // Beispiel: Mindestanzahl von Spielern
      console.log(`Nicht genügend Spieler im Spiel ${gameId}.`);
      return;
    }

    game.currentRound = 1;
    const hands = dealCards(game.deck, game.players.length, game.currentRound);

    game.players.forEach((player, index) => {
      player.hand = hands[index];
      // Sende die Handkarten an den jeweiligen Spieler
      io.to(player.id).emit('hand', player.hand);
    });

    // Informiere alle Spieler über den Spielstart
    io.to(gameId).emit('gameStarted', { currentRound: game.currentRound });
  });

  // Listener für 'joinGame'
  socket.on('joinGame', ({ gameId, playerName }) => {
    console.log(`Spieler ${playerName} tritt dem Spiel ${gameId} bei.`);
    if (!games[gameId]) {
      games[gameId] = {
        players: [],
        deck: createDeck(),
        currentRound: 0,
        // Weitere Spielinformationen
      };
    }

    const game = games[gameId];
    game.players.push({
      id: socket.id,
      name: playerName,
      score: 0,
      hand: [],
      // Weitere Spielerinformationen
    });

    socket.join(gameId);
    io.to(gameId).emit('playerJoined', game.players);
  });  

  socket.on('disconnect', () => {
    console.log('Ein Benutzer hat die Verbindung getrennt:', socket.id);
    // Optional: Entferne den Spieler aus dem Spiel und informiere andere Spieler
  });
});

function determineStichGewinner(stich) {
  // Implementiere die Logik zur Bestimmung des Stichgewinners
  // Dies kann Trumpffarben, Wizard- und Jester-Karten berücksichtigen
  // Hier ein einfaches Beispiel:
  return stich[0].playerId; // Platzhalter: erster Spieler gewinnt
}

function updateScores(game, winnerId) {
  const winner = game.players.find(p => p.id === winnerId);
  if (winner) {
    winner.score += 1;
  }
}

function getNextPlayerId(game, currentPlayerId) {
  const index = game.players.findIndex(p => p.id === currentPlayerId);
  return game.players[(index + 1) % game.players.length].id;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
