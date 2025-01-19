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

  // Spieler einem Spiel beitreten
  socket.on('joinGame', ({ gameId, playerName }) => {
    console.log(`Spieler ${playerName} tritt dem Spiel ${gameId} bei.`);
    if (!games[gameId]) {
      games[gameId] = {
        players: [],
        deck: createDeck(),
        currentRound: 1,
        bids: {},
        tricks: [],
        scores: {},
        currentTrick: [],
        roundOver: false,
        gameOver: false,
      };
    }

    const game = games[gameId];
    game.players.push({
      id: socket.id,
      name: playerName,
      hand: [],
      bid: null,
      tricksWon: 0,
      score: 0,
    });

    game.scores[socket.id] = 0;

    socket.join(gameId);
    io.to(gameId).emit('playerJoined', game.players.map(p => ({ id: p.id, name: p.name })));
  });

  // Spiel starten
  socket.on('startGame', ({ gameId }) => {
    const game = games[gameId];
    if (!game) {
      console.log(`Spiel mit ID ${gameId} existiert nicht.`);
      return;
    }

    if (game.players.length < 2) {
      socket.emit('error', 'Nicht genügend Spieler zum Starten des Spiels.');
      return;
    }

    // Initialisiere die erste Runde
    startRound(gameId);
  });

  // Bids entgegennehmen
  socket.on('makeBid', ({ gameId, bid }) => {
    const game = games[gameId];
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    player.bid = bid;
    game.bids[socket.id] = bid;

    io.to(gameId).emit('bidMade', { playerId: socket.id, bid });

    // Prüfen, ob alle Spieler gebidet haben
    if (Object.keys(game.bids).length === game.players.length) {
      io.to(gameId).emit('bidsCompleted', game.bids);
      // Spieler können nun Karten spielen
    }
  });

  // Karten spielen
  socket.on('playCard', ({ gameId, card }) => {
    const game = games[gameId];
    if (!game) return;

    const player = game.players.find(p => p.id === socket.id);
    if (!player) return;

    // Überprüfen, ob die Karte in der Hand des Spielers ist
    const cardIndex = player.hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
    if (cardIndex === -1) {
      socket.emit('error', 'Karte nicht in der Hand.');
      return;
    }

    // Entferne die Karte aus der Hand
    player.hand.splice(cardIndex, 1);

    // Füge die Karte zum aktuellen Stich hinzu
    game.currentTrick.push({ playerId: socket.id, card });

    // Informiere alle Spieler über den gespielten Stich
    io.to(gameId).emit('cardPlayed', { playerId: socket.id, card });

    // Prüfe, ob alle Spieler eine Karte gespielt haben
    if (game.currentTrick.length === game.players.length) {
      // Bestimme den Gewinner des Stiches
      const winnerId = determineTrickWinner(game.currentTrick);
      const winner = game.players.find(p => p.id === winnerId);
      winner.tricksWon += 1;

      // Informiere alle Spieler über den Gewinner des Stiches
      io.to(gameId).emit('trickWon', { winnerId, trick: game.currentTrick });

      // Füge den Stich zur Liste der Tricks hinzu
      game.tricks.push({ winnerId, trick: game.currentTrick });

      // Aktualisiere die Punktzahl
      updateScores(game);

      // Bereite den nächsten Stich vor
      game.currentTrick = [];

      // Überprüfe, ob die Runde vorbei ist
      if (winner.tricksWon === determineCardsPerPlayer(game.currentRound, game.players.length)) {
        // Runde beenden und nächsten Runde starten
        io.to(gameId).emit('roundOver', { scores: game.scores });
        if (game.currentRound >= 10) { // Beispiel: max. 10 Runden
          game.gameOver = true;
          const finalScores = Object.keys(game.scores).map(id => ({
            playerId: id,
            score: game.scores[id],
            name: game.players.find(p => p.id === id).name
          }));
          io.to(gameId).emit('gameOver', finalScores);
        } else {
          // Starte die nächste Runde
          game.currentRound += 1;
          startRound(gameId);
        }
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Ein Benutzer hat die Verbindung getrennt:', socket.id);
    // Optional: Entferne den Spieler aus dem Spiel und informiere andere Spieler
    for (const gameId in games) {
      const game = games[gameId];
      const playerIndex = game.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const playerName = game.players[playerIndex].name;
        game.players.splice(playerIndex, 1);
        delete game.scores[socket.id];
        io.to(gameId).emit('playerLeft', { id: socket.id, name: playerName });
        // Weitere Logik zur Handhabung eines Spielabbruchs oder Spielerabgangs
        break;
      }
    }
  });
});

// Funktion zum Starten einer Runde
function startRound(gameId) {
  const game = games[gameId];
  if (!game) return;

  // Reset Bids und Tricks
  game.bids = {};
  game.tricks = [];
  game.currentTrick = [];

  // Bestimme die Anzahl der Karten pro Spieler
  const cardsPerPlayer = determineCardsPerPlayer(game.currentRound, game.players.length);

  // Stelle sicher, dass das Deck genügend Karten hat
  if (game.deck.length < game.players.length * cardsPerPlayer) {
    // Falls nicht, mische das Deck neu
    game.deck = createDeck();
  }

  // Teile die Karten aus
  const hands = dealCards(game.deck, game.players.length, game.currentRound);
  game.players.forEach((player, index) => {
    player.hand = hands[index];
    // Sende die Handkarten an den jeweiligen Spieler
    io.to(player.id).emit('hand', player.hand);
    // Reset Tricks Won
    player.tricksWon = 0;
    // Reset Bids
    player.bid = null;
  });

  // Informiere alle Spieler über den Spielstart
  io.to(gameId).emit('gameStarted', { currentRound: game.currentRound, cardsPerPlayer });
}

// Funktion zur Bestimmung des Stichgewinners (vereinfacht)
function determineTrickWinner(trick) {
    let winningPlay = null;
    let trumpPlayed = false;
  
    trick.forEach(play => {
      if (play.card.rank === 'Wizard') {
        if (!winningPlay || winningPlay.card.rank !== 'Wizard') {
          winningPlay = play;
        } else {
          // Mehrere Wizards: der erste gewinnt
        }
      } else if (play.card.rank !== 'Jester') {
        if (winningPlay && winningPlay.card.rank !== 'Wizard' && winningPlay.card.suit === play.card.suit) {
          if (compareCards(play.card, winningPlay.card) > 0) {
            winningPlay = play;
          }
        } else if (!winningPlay || (winningPlay.card.rank === 'Jester')) {
          winningPlay = play;
        }
      }
    });
  
    // Wenn kein Wizard gespielt wurde, bestimme die höchste Karte der angespielten Farbe
    if (winningPlay === null) {
      // Bestimme die Farbe der ersten Karte
      const leadSuit = trick[0].card.suit;
      trick.forEach(play => {
        if (play.card.suit === leadSuit && play.card.rank !== 'Jester') {
          if (!winningPlay || compareCards(play.card, winningPlay.card) > 0) {
            winningPlay = play;
          }
        }
      });
    }
  
    // Falls immer noch kein Gewinner, keiner gewinnt
    if (!winningPlay) {
      return null;
    }
  
    return winningPlay.playerId;
  }
  

// Vergleichsfunktion für Karten (vereinfachte Version)
function compareCards(cardA, cardB) {
  const rankOrder = {
    'Jester': 0,
    '1': 1,
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'Jack': 11,
    'Queen': 12,
    'King': 13,
    'Wizard': 14
  };

  if (cardA.rank === 'Wizard') return 1;
  if (cardB.rank === 'Wizard') return -1;
  if (cardA.rank === 'Jester') return -1;
  if (cardB.rank === 'Jester') return 1;

  return rankOrder[cardA.rank] - rankOrder[cardB.rank];
}

// Funktion zur Aktualisierung der Punktzahlen
function updateScores(game) {
    game.players.forEach(player => {
      const bid = player.bid;
      const tricks = player.tricksWon;
  
      if (bid === tricks) {
        // Exakte Treffer: +20 Punkte + 10 pro richtiger Stich
        player.score += 20 + (10 * tricks);
      } else {
        // Falsche Schätzung: -10 Punkte pro Stich Differenz
        player.score -= Math.abs(bid - tricks) * 10;
      }
  
      game.scores[player.id] = player.score;
    });
  
    // Sende die aktualisierten Punktestände an alle Spieler
    io.to(gameId).emit('scoresUpdated', game.scores);
  }
  

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
});
