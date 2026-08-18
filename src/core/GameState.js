export const GameState = Object.freeze({
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

export class GameStateManager {
  constructor(initialState = GameState.MENU) {
    this.state = initialState;
    this.listeners = new Set();
  }

  set(nextState) {
    if (nextState === this.state) return;
    const previous = this.state;
    this.state = nextState;
    for (const listener of this.listeners) listener(nextState, previous);
  }

  is(state) {
    return this.state === state;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
