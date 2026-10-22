import { TacticalGameState, StateSnapshot } from '../../types/tactical';

export class TacticalHistoryEngine {
  private snapshots: Map<number, StateSnapshot> = new Map();

  /**
   * Captures an immutable snapshot of the game state at the beginning of a turn
   */
  public captureSnapshot(state: TacticalGameState): void {
    const snapshot: StateSnapshot = {
      turnNumber: state.turnNumber,
      stateJson: JSON.stringify(state),
      timestamp: Date.now(),
    };
    this.snapshots.set(state.turnNumber, snapshot);
  }

  /**
   * Retrieves a snapshot for a specific turn number
   */
  public getSnapshot(turnNumber: number): TacticalGameState | null {
    const snapshot = this.snapshots.get(turnNumber);
    if (!snapshot) return null;
    try {
      return JSON.parse(snapshot.stateJson) as TacticalGameState;
    } catch {
      return null;
    }
  }

  /**
   * Gets list of all saved turn numbers
   */
  public getAvailableTurns(): number[] {
    return Array.from(this.snapshots.keys()).sort((a, b) => a - b);
  }

  /**
   * Clears history (e.g. on new match)
   */
  public clear(): void {
    this.snapshots.clear();
  }
}

export const tacticalHistory = new TacticalHistoryEngine();
