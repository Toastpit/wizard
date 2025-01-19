// wizard-online/src/App.js

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3001');

function App() {
  const [playerName, setPlayerName] = useState('');
  const [gameId, setGameId] = useState('');
  const [players, setPlayers] = useState([]);
  const [hand, setHand] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [cardsPerPlayer, setCardsPerPlayer] = useState(1);
  const [bids, setBids] = useState({});
  const [currentTrick, setCurrentTrick] = useState([]);
  const [scores, setScores] = useState({});
  const [messages, setMessages] = useState([]);
  const [tricks, setTricks] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [finalScores, setFinalScores] = useState([]);

  useEffect(() => {
    // Empfang von Spielzügen vom Server
    socket.on('spielZug', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    // Empfang von Handkarten
    socket.on('hand', (cards) => {
      setHand(cards);
    });

    // Empfang von Spielstart
    socket.on('gameStarted', ({ currentRound, cardsPerPlayer }) => {
      console.log(`Spiel gestartet: Runde ${currentRound}, Karten pro Spieler: ${cardsPerPlayer}`);
      setGameStarted(true);
      setCurrentRound(currentRound);
      setCardsPerPlayer(cardsPerPlayer);
      setBids({});
      setTricks([]);
    });

    // Empfang von 'playerJoined'
    socket.on('playerJoined', (players) => {
      setPlayers(players);
    });

    // Empfang von Bids
    socket.on('bidMade', ({ playerId, bid }) => {
      setBids(prevBids => ({ ...prevBids, [playerId]: bid }));
    });

    socket.on('bidsCompleted', (allBids) => {
      setBids(allBids);
      setMessages(['Alle Spieler haben gebidet. Beginnt das Spielen der Karten.']);
    });

    // Empfang von gespielten Karten
    socket.on('cardPlayed', ({ playerId, card }) => {
      setCurrentTrick(prevTrick => [...prevTrick, { playerId, card }]);
      setMessages(prev => [...prev, `${getPlayerName(playerId)} hat ${card.rank} of ${card.suit} gespielt.`]);
    });

    // Empfang von Trickgewinner
    socket.on('trickWon', ({ winnerId, trick }) => {
      setTricks(prev => [...prev, { winnerId, trick }]);
      setMessages(prev => [...prev, `${getPlayerName(winnerId)} hat den Stich gewonnen.`]);
    });

    // Empfang von Rundenschluss
    socket.on('roundOver', ({ scores }) => {
      setScores(scores);
      setMessages(prev => [...prev, `Runde ${currentRound} ist vorbei. Punkte aktualisiert.`]);
      // Optional: Zeige eine Übersicht der Runde
    });

    // Empfang von Punkteständen
    socket.on('scoresUpdated', (updatedScores) => {
      setScores(updatedScores);
    });

    // Empfang von Spielabschluss
    socket.on('gameOver', (finalScores) => {
      setGameOver(true);
      setFinalScores(finalScores);
      setMessages(['Das Spiel ist beendet!']);
    });

    // Empfang von Spielerabgang
    socket.on('playerLeft', ({ id, name }) => {
      setPlayers(prevPlayers => prevPlayers.filter(p => p.id !== id));
      setMessages([`${name} hat das Spiel verlassen.`]);
    });

    // Empfang von Fehlern
    socket.on('error', (errorMsg) => {
      setMessages([`Fehler: ${errorMsg}`]);
    });

    return () => {
      socket.off('spielZug');
      socket.off('hand');
      socket.off('gameStarted');
      socket.off('playerJoined');
      socket.off('bidMade');
      socket.off('bidsCompleted');
      socket.off('cardPlayed');
      socket.off('trickWon');
      socket.off('roundOver');
      socket.off('scoresUpdated');
      socket.off('gameOver');
      socket.off('playerLeft');
      socket.off('error');
    };
  }, [currentRound]);

  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player ? player.name : 'Unbekannt';
  };

  const joinGame = () => {
    if (playerName.trim() === '' || gameId.trim() === '') return;
    socket.emit('joinGame', { gameId, playerName });
  };

  const startGame = () => {
    if (gameId.trim() === '') return;
    socket.emit('startGame', { gameId });
  };

  const makeBid = (bid) => {
    if (bid < 0 || isNaN(bid)) return;
    socket.emit('makeBid', { gameId, bid });
  };

  const playCard = (card) => {
    socket.emit('playCard', { gameId, card });
    // Entferne die Karte aus der Hand im Frontend
    setHand(hand.filter(c => !(c.rank === card.rank && c.suit === card.suit)));
  };

  const startNextRound = () => {
    // Diese Funktion könnte verwendet werden, um die nächste Runde zu starten
  };

  // UI-Komponenten für das Bidding und das Spielen von Karten

  return (
    <div className="App">
      <h1>Wizard Online</h1>

      {!gameStarted && !gameOver && (
        <div className="join-game">
          <h2>Spiel beitreten</h2>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Dein Name"
          />
          <input
            type="text"
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            placeholder="Spiel-ID"
          />
          <button onClick={joinGame}>Spiel beitreten</button>
          <button onClick={startGame} disabled={players.length < 2}>
            Spiel starten
          </button>
          <div className="players">
            <h3>Spieler:</h3>
            <ul>
              {players.map((player, index) => (
                <li key={index}>{player.name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {gameStarted && !gameOver && (
        <div className="game">
          <h2>Runde {currentRound}</h2>
          <h3>Karten pro Spieler: {cardsPerPlayer}</h3>

          {/* Bidding-Bereich */}
          {Object.keys(bids).length < players.length && (
            <div className="bidding">
              <h3>Gib deinen Bid ab</h3>
              <BidForm makeBid={makeBid} />
            </div>
          )}

          {/* Handkarten anzeigen, wenn Bidding abgeschlossen ist */}
          {Object.keys(bids).length === players.length && (
          <div className="hand">
            <h3>Deine Hand:</h3>
            {hand.length > 0 ? (
              hand.map((card, index) => (
                <div className="card" key={index} onClick={() => playCard(card)}>
                  <strong>{card.rank}</strong>
                  <br />
                  {card.suit}
                </div>
              ))
            ) : (
              <p>Keine Karten in der Hand.</p>
            )}
          </div>
        )}

          {/* Aktueller Stich */}
          <div className="current-trick">
            <h3>Aktueller Stich:</h3>
            <ul>
              {currentTrick.map((play, index) => (
                <li key={index}>
                  <div className="card">
                    <strong>{play.card.rank}</strong>
                    <br />
                    {play.card.suit}
                  </div>
                  <span>{getPlayerName(play.playerId)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Punktetabelle */}
          <div className="scoreboard">
            <h3>Punktetabelle:</h3>
            <table>
              <thead>
                <tr>
                  <th>Spieler</th>
                  <th>Punkte</th>
                </tr>
              </thead>
              <tbody>
                {players.map((player, index) => (
                  <tr key={index}>
                    <td>{player.name}</td>
                    <td>{scores[player.id] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Nachrichten */}
          <div className="messages">
            <h3>Nachrichten:</h3>
            <ul>
              {messages.map((msg, index) => (
                <li key={index}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="game-over">
          <h2>Spiel ist vorbei!</h2>
          <h3>Endstand:</h3>
          <table>
            <thead>
              <tr>
                <th>Spieler</th>
                <th>Punkte</th>
              </tr>
            </thead>
            <tbody>
              {finalScores.map((player, index) => (
                <tr key={index}>
                  <td>{player.name}</td>
                  <td>{player.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => window.location.reload()}>Neues Spiel starten</button>
        </div>
      )}
    </div>
  );
}

// Komponente für das Bidding-Formular
function BidForm({ makeBid }) {
  const [bid, setBid] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const bidNumber = parseInt(bid, 10);
    if (!isNaN(bidNumber) && bidNumber >= 0) {
      makeBid(bidNumber);
      setBid('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="number"
        value={bid}
        onChange={(e) => setBid(e.target.value)}
        placeholder="Dein Bid"
        min="0"
      />
      <button type="submit">Bid abgeben</button>
    </form>
  );
}

export default App;
