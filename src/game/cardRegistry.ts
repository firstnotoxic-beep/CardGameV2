import { CardDefinition } from '../types/game';
import { CARD_DATABASE } from '../data/cards';

class CardRegistry {
  private cards: Record<string, CardDefinition> = {};
  private listeners: (() => void)[] = [];

  constructor() {
    this.resetToDefaults();
  }

  public resetToDefaults() {
    this.cards = { ...CARD_DATABASE };
  }

  public getCard(id: string): CardDefinition | undefined {
    return this.cards[id];
  }

  public getAllCards(): Record<string, CardDefinition> {
    return { ...this.cards };
  }

  public registerCard(card: CardDefinition) {
    this.cards[card.id] = { ...card };
    this.notify();
  }

  public registerMany(cards: CardDefinition[]) {
    cards.forEach((card) => {
      this.cards[card.id] = { ...card };
    });
    this.notify();
  }

  public removeCustomCard(cardId: string) {
    if (this.cards[cardId]?.isCustom) {
      delete this.cards[cardId];
      this.notify();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Error in card registry listener:', err);
      }
    });
  }
}

export const cardRegistry = new CardRegistry();

export function getCardDef(id: string): CardDefinition | undefined {
  return cardRegistry.getCard(id) || CARD_DATABASE[id];
}
