// backend/utils/deck.js

function createDeck() {
    const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
    const ranks = [
      '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
      'Jack', 'Queen', 'King', 'Wizard', 'Jester'
    ];
    let deck = [];
  
    suits.forEach(suit => {
      ranks.forEach(rank => {
        deck.push({ suit, rank });
      });
    });
  
    // Füge zusätzliche Wizard- und Jester-Karten hinzu, falls nötig
    // ...
  
    // Mische das Deck
    deck = shuffle(deck);
    return deck;
  }
  
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
  
  function dealCards(deck, numberOfPlayers, round) {
    const cardsPerPlayer = determineCardsPerPlayer(round, numberOfPlayers);
    const hands = [];
  
    for (let i = 0; i < numberOfPlayers; i++) {
      hands.push(deck.splice(0, cardsPerPlayer));
    }
  
    return hands;
  }
  
  function determineCardsPerPlayer(round, numberOfPlayers) {
    // Beispiel: In Runde 1 wird 1 Karte pro Spieler ausgeteilt, Runde 2: 2 Karten, etc.
    return round + 1; // Kann angepasst werden
  }
  
  module.exports = { createDeck, dealCards, determineCardsPerPlayer };
  