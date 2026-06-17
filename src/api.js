// src/api.js

const API_BASE = 'http://localhost:3000/api';
const ROOT_BASE = 'http://localhost:3000';

/**
 * Helper générique pour effectuer des requêtes HTTP fetch.
 * @param {string} url - URL complète de la requête
 * @param {object} options - Options fetch (method, body, headers, etc.)
 */
async function sendRequest(url, options = {}) {
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    let result;
    
    try {
      result = await response.json();
    } catch (e) {
      result = null;
    }

    if (!response.ok) {
      const errorMsg = (result && result.error) || `Erreur serveur (${response.status})`;
      throw new Error(errorMsg);
    }

    return result; // Retourne le format standard { success: true, data: ..., timestamp: ... }
  } catch (error) {
    console.error(`Erreur API lors de l'appel à ${url}:`, error);
    throw error;
  }
}

/**
 * Service API exposé pour le frontend
 */
export const api = {
  /**
   * Vérifie la santé de l'API (Ping)
   */
  async checkHealth() {
    // Le health check se trouve sur /health par rapport à la racine
    return sendRequest(`${ROOT_BASE}/health`, { method: 'GET' });
  },

  /**
   * Récupère la liste de tous les comptes bancaires
   */
  async getAccounts() {
    return sendRequest(`${API_BASE}/accounts`, { method: 'GET' });
  },

  /**
   * Récupère les détails d'un compte spécifique
   * @param {string} id - ID unique du compte
   */
  async getAccount(id) {
    return sendRequest(`${API_BASE}/accounts/${id}`, { method: 'GET' });
  },

  /**
   * Crée un nouveau compte bancaire
   * @param {object} accountData - { firstName, lastName, email, accountType }
   */
  async createAccount(accountData) {
    return sendRequest(`${API_BASE}/accounts`, {
      method: 'POST',
      body: JSON.stringify(accountData),
    });
  },

  /**
   * Met à jour les informations d'un compte (Type, Statut)
   * @param {string} id - ID unique du compte
   * @param {object} updates - { firstName, lastName, accountType, status }
   */
  async updateAccount(id, updates) {
    return sendRequest(`${API_BASE}/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Supprime un compte bancaire et toutes ses transactions
   * @param {string} id - ID unique du compte
   */
  async deleteAccount(id) {
    return sendRequest(`${API_BASE}/accounts/${id}`, { method: 'DELETE' });
  },

  /**
   * Effectue un dépôt d'argent sur un compte
   * @param {string} id - ID unique du compte
   * @param {number} amount - Montant à déposer (>0)
   * @param {string} description - Description de la transaction
   */
  async deposit(id, amount, description) {
    return sendRequest(`${API_BASE}/accounts/${id}/deposit`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  },

  /**
   * Effectue un retrait d'argent d'un compte
   * @param {string} id - ID unique du compte
   * @param {number} amount - Montant à retirer (>0)
   * @param {string} description - Description de la transaction
   */
  async withdraw(id, amount, description) {
    return sendRequest(`${API_BASE}/accounts/${id}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  },

  /**
   * Récupère l'historique complet des transactions d'un compte
   * @param {string} id - ID unique du compte
   */
  async getTransactions(id) {
    return sendRequest(`${API_BASE}/accounts/${id}/transactions`, { method: 'GET' });
  },
};
