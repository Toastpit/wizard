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
  
    // Wizard und Jester-Karten bereits enthalten, falls erforderlich weitere hinzufügen
  
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
    // In Wizard beginnt man mit 1 Karte und erhöht pro Runde
    return round; // Runde 1: 1 Karte, Runde 2: 2 Karten, etc.
  }
  
  module.exports = { createDeck, dealCards, determineCardsPerPlayer };
  