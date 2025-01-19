// wizard-online/src/App.js

import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('http://localhost:3001');

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [hand, setHand] = useState([]);
  const [gameId, setGameId] = useState('defaultGameId'); // Beispiel-Game-ID
  const [playerName, setPlayerName] = useState('Player1'); // Beispiel-Name
  const [players, setPlayers] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);

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
    socket.on('gameStarted', ({ currentRound }) => {
      console.log(`Spiel gestartet: Runde ${currentRound}`);
      setGameStarted(true);
      // Weitere Logik für den Spielstart
    });

    // Empfang von Stichabschlüssen
    socket.on('stichAbgeschlossen', ({ winner, stich }) => {
      console.log(`Stich gewonnen von: ${winner}`);
      // Aktualisiere die Anzeige entsprechend
    });

    // Empfang von naechsterSpieler
    socket.on('naechsterSpieler', ({ spielerId }) => {
      console.log(`Nächster Spieler: ${spielerId}`);
      // Zeige an, welcher Spieler am Zug ist
    });

    // Empfang von 'playerJoined'
    socket.on('playerJoined', (players) => {
      setPlayers(players);
    });

    // Bereinigung bei unmount
    return () => {
      socket.off('spielZug');
      socket.off('hand');
      socket.off('gameStarted');
      socket.off('stichAbgeschlossen');
      socket.off('naechsterSpieler');
      socket.off('playerJoined');
    };
  }, []);

  const joinGame = () => {
    if (playerName.trim() === '') return;
    socket.emit('joinGame', { gameId, playerName });
  };

  const startGame = () => {
    socket.emit('startGame', { gameId });
  };

  const sendZug = () => {
    if (input.trim() === '') return;
    // Sende den Spielzug an den Server
    socket.emit('spielZug', { gameId, card: input }); // Hier solltest du tatsächlich eine Karte senden
    setMessages((prev) => [...prev, `Du: ${input}`]);
    setInput('');
  };

  const playCard = (card) => {
    socket.emit('spielZug', { gameId, card });
    // Entferne die Karte aus der Hand im Frontend
    setHand(hand.filter(c => !(c.rank === card.rank && c.suit === card.suit)));
  };

  return (
    <div className="App">
      <h1>Wizard Online</h1>

      {/* Formular zum Beitreten des Spiels */}
      <div className="join-game">
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
      </div>

      {/* Anzeige der Spieler */}
      <div className="players">
        <h2>Spieler:</h2>
        <ul>
          {players.map((player, index) => (
            <li key={index}>{player.name}</li>
          ))}
        </ul>
      </div>

      {/* Button zum Starten des Spiels */}
      <button onClick={startGame} disabled={gameStarted}>
        Spiel starten
      </button>

      {/* Anzeige der Handkarten */}
      <div className="hand">
        <h2>Deine Hand:</h2>
        {hand.length > 0 ? (
          hand.map((card, index) => (
            <button key={index} onClick={() => playCard(card)}>
              {card.rank} of {card.suit}
            </button>
          ))
        ) : (
          <p>Keine Karten in der Hand.</p>
        )}
      </div>

      {/* Chat oder Nachrichten */}
      <div className="chat-box">
        <h2>Nachrichten:</h2>
        <ul>
          {messages.map((msg, index) => (
            <li key={index}>{msg}</li>
          ))}
        </ul>
        {/* Optional: Eingabefeld für Chat-Nachrichten */}
      </div>
    </div>
  );
}

export default App;
