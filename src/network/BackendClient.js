const PLAYER_ID_KEY = 'pvl_backend_player_id_v1';

export class BackendClient {
  constructor({ baseUrl = '/api', storage = null } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.storage = storage ?? this._resolveStorage();
    this.playerId = this.storage?.getItem(PLAYER_ID_KEY) || null;
    this.status = 'OFFLINE';
    this.lastError = null;
  }

  _resolveStorage() {
    try { return globalThis.localStorage ?? null; } catch { return null; }
  }

  _savePlayerId(id) {
    this.playerId = id;
    try { this.storage?.setItem(PLAYER_ID_KEY, id); } catch { /* fallback local */ }
  }

  async _request(path, options = {}) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Backend ${response.status}: ${text || response.statusText}`);
    }
    return response.status === 204 ? null : response.json();
  }

  async initialize(profile) {
    try {
      const payload = await this._request('/players', {
        method: 'POST',
        body: JSON.stringify({ playerId: this.playerId, profile }),
      });
      this._savePlayerId(payload.player.id);
      this.status = 'ONLINE';
      this.lastError = null;
      return payload.player;
    } catch (error) {
      this.status = 'OFFLINE';
      this.lastError = error;
      return null;
    }
  }

  async syncProfile(profile) {
    if (!this.playerId) return this.initialize(profile);
    try {
      const payload = await this._request(`/players/${encodeURIComponent(this.playerId)}/profile`, {
        method: 'PUT',
        body: JSON.stringify({ profile }),
      });
      this.status = 'ONLINE';
      this.lastError = null;
      return payload.player;
    } catch (error) {
      this.status = 'OFFLINE';
      this.lastError = error;
      return null;
    }
  }

  async submitRun(run, profile) {
    if (!this.playerId) await this.initialize(profile);
    if (!this.playerId) return null;
    try {
      const payload = await this._request(`/players/${encodeURIComponent(this.playerId)}/runs`, {
        method: 'POST',
        body: JSON.stringify({ run, profile }),
      });
      this.status = 'ONLINE';
      this.lastError = null;
      return payload;
    } catch (error) {
      this.status = 'OFFLINE';
      this.lastError = error;
      return null;
    }
  }

  async getPlayer() {
    if (!this.playerId) return null;
    try {
      const payload = await this._request(`/players/${encodeURIComponent(this.playerId)}`);
      this.status = 'ONLINE';
      this.lastError = null;
      return payload.player;
    } catch (error) {
      this.status = 'OFFLINE';
      this.lastError = error;
      return null;
    }
  }

  async getRanking(period = 'global', limit = 50) {
    try {
      const params = new URLSearchParams({ period, limit: String(limit) });
      if (this.playerId) params.set('playerId', this.playerId);
      const payload = await this._request(`/ranking?${params.toString()}`);
      this.status = 'ONLINE';
      this.lastError = null;
      return payload;
    } catch (error) {
      this.status = 'OFFLINE';
      this.lastError = error;
      return null;
    }
  }

  isOnline() { return this.status === 'ONLINE'; }
}
