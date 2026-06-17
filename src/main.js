// src/main.js
import './style.css';
import { api } from './api.js';

// Application State
const state = {
  accounts: [],
  filteredAccounts: [],
  selectedAccount: null,
  isApiConnected: false,
  currentView: 'login', // Default view
  user: JSON.parse(localStorage.getItem('user')) || null,
  banks: [],
  filters: {
    search: '',
    type: '',
    status: '',
  },
};

// ================= UTILITIES =================

/**
 * Format currency in FCFA
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XOF', // West African CFA Franc
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace('XOF', 'FCFA');
}

/**
 * Format Date to local French format
 */
function formatDate(isoString) {
  if (!isoString) return 'N/A';
  return new Date(isoString).toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Show a sleek Toast Notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  toast.innerHTML = `
    <span class="toast-message">${message}</span>
    <button class="toast-close">&times;</button>
  `;

  // Close button click
  toast.querySelector('.toast-close').addEventListener('click', () => {
    toast.classList.add('fadeOut');
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  // Auto remove after 4.5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('fadeOut');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

// ================= NAVIGATION / ROUTING =================

/**
 * Toggle views (Single Page Application routing)
 */
function showView(viewId) {
  state.currentView = viewId;

  // Toggle active view CSS
  document.querySelectorAll('.content-view').forEach(view => {
    view.classList.remove('active');
  });
  
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Hide sidebar/header on login/register
  const sidebar = document.querySelector('.sidebar');
  const header = document.querySelector('.top-header');
  const mainPanel = document.querySelector('.main-panel');
  
  if (viewId === 'login' || viewId === 'register') {
    if (sidebar) sidebar.style.display = 'none';
    if (header) header.style.display = 'none';
    if (mainPanel) mainPanel.style.marginLeft = '0';
  } else {
    if (sidebar) sidebar.style.display = 'flex';
    if (header) header.style.display = 'flex';
  }

  // Update navigation button active states
  document.querySelectorAll('.nav-item').forEach(btn => {
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update header title
  const titleEl = document.getElementById('current-view-title');
  if (viewId === 'dashboard') {
    titleEl.textContent = 'Tableau de Bord';
    loadAccounts(); // Refresh accounts list
  } else if (viewId === 'new-account') {
    titleEl.textContent = 'Nouveau Compte';
    loadBanks();
  } else if (viewId === 'account-details') {
    titleEl.textContent = 'Détails du Compte';
  } else if (viewId === 'banks') {
    titleEl.textContent = 'Gestion des Banques';
    loadBanks();
  }

  // Handle Auth UI
  if (state.user && viewId !== 'login' && viewId !== 'register') {
    document.getElementById('current-user-info').style.display = 'flex';
    document.getElementById('user-profile-name').textContent = state.user.firstName;
    document.getElementById('user-profile-role').textContent = state.user.role === 'SUPERADMIN' ? 'Administrateur' : 'Utilisateur';
    document.getElementById('btn-logout').style.display = 'block';
    
    // Hide New Account for normal users, hide Banks for normal users
    if (state.user.role !== 'SUPERADMIN') {
      document.getElementById('nav-btn-banks').style.display = 'none';
      document.getElementById('nav-btn-new-account').style.display = 'flex';
    } else {
      document.getElementById('nav-btn-banks').style.display = 'flex';
      document.getElementById('nav-btn-new-account').style.display = 'flex';
    }
  } else {
    document.getElementById('current-user-info').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'none';
  }
}

// ================= API HEALTH CHECK =================

/**
 * Pings the API health endpoint to update UI connection state
 */
async function checkApiConnection() {
  const dot = document.getElementById('status-dot');
  const text = document.getElementById('status-text');

  try {
    const res = await api.checkHealth();
    if (res && res.success) {
      state.isApiConnected = true;
      dot.className = 'status-dot-indicator connected';
      text.textContent = 'API Connectée';
    } else {
      throw new Error('API non opérationnelle');
    }
  } catch (error) {
    state.isApiConnected = false;
    dot.className = 'status-dot-indicator disconnected';
    text.textContent = 'API Hors Ligne';
  }
}

// ================= DATA LOADING & RENDERING =================

/**
 * Load accounts from server, calculate metrics and render the list
 */
async function loadAccounts() {
  const tbody = document.getElementById('accounts-list-body');

  try {
    const response = state.user?.role === 'SUPERADMIN' 
      ? await api.getAllAccounts() 
      : await api.getMyAccounts();
      
    if (response && response.success) {
      state.accounts = response.data.accounts || [];
      applyFilters();
      calculateMetrics();
      renderAccountsTable();
    } else {
      throw new Error("Impossible de récupérer la liste des comptes");
    }
  } catch (err) {
    showToast(err.message, 'error');
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-danger); margin-bottom: 0.5rem;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          Erreur de chargement. Vérifiez que le serveur API est démarré.
        </td>
      </tr>
    `;
  }
}

/**
 * Load banks from server
 */
async function loadBanks() {
  const selectEl = document.getElementById('create-bank-id');
  const tbody = document.getElementById('banks-list-body');
  
  if (tbody) tbody.innerHTML = '<tr><td colspan="2"><div class="spinner"></div> Chargement...</td></tr>';

  try {
    const response = await api.getBanks();
    if (response && response.success) {
      state.banks = response.data || [];
      
      // Update select element in "Nouveau Compte"
      if (selectEl) {
        selectEl.innerHTML = '<option value="">Sélectionnez une banque...</option>' + 
          state.banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
      }

      // Update Banks Table in "Banques" view
      if (tbody) {
        if (state.banks.length === 0) {
          tbody.innerHTML = '<tr><td colspan="2" class="empty-state">Aucune banque enregistrée.</td></tr>';
        } else {
          tbody.innerHTML = state.banks.map(b => `
            <tr>
              <td class="weight-semibold">${b.name}</td>
              <td>${formatDate(b.createdAt)}</td>
            </tr>
          `).join('');
        }
      }
    }
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="2" class="empty-state">Erreur de chargement des banques.</td></tr>`;
  }
}

/**
 * Calculate dashboard summary metrics
 */
function calculateMetrics() {
  const totalBalanceEl = document.getElementById('stat-total-balance');
  const totalAccountsEl = document.getElementById('stat-total-accounts');
  const activePercentEl = document.getElementById('stat-active-accounts');

  const count = state.accounts.length;
  totalAccountsEl.textContent = count;

  if (count === 0) {
    totalBalanceEl.textContent = '0 FCFA';
    activePercentEl.textContent = '0%';
    return;
  }

  const totalBalance = state.accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  totalBalanceEl.textContent = formatCurrency(totalBalance);

  const activeCount = state.accounts.filter(acc => acc.status === 'Active').length;
  const activePercent = Math.round((activeCount / count) * 100);
  activePercentEl.textContent = `${activePercent}%`;
}

/**
 * Apply in-memory search and dropdown filters
 */
function applyFilters() {
  const { search, type, status } = state.filters;
  
  state.filteredAccounts = state.accounts.filter(acc => {
    const userName = acc.user ? `${acc.user.firstName} ${acc.user.lastName}` : 'Inconnu';
    const email = acc.user ? acc.user.email : 'Inconnu';
    const nameMatch = userName.toLowerCase().includes(search.toLowerCase());
    const emailMatch = email.toLowerCase().includes(search.toLowerCase());
    const numMatch = acc.accountNumber.toLowerCase().includes(search.toLowerCase());
    const textMatch = nameMatch || emailMatch || numMatch;

    const typeMatch = !type || acc.accountType === type;
    const statusMatch = !status || acc.status === status;

    return textMatch && typeMatch && statusMatch;
  });
}

/**
 * Render accounts into HTML table
 */
function renderAccountsTable() {
  const tbody = document.getElementById('accounts-list-body');
  
  if (state.filteredAccounts.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          Aucun compte ne correspond aux critères de recherche.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.filteredAccounts.map(acc => {
    const name = acc.user ? `${acc.user.firstName} ${acc.user.lastName}` : 'Inconnu';
    const email = acc.user ? acc.user.email : 'Inconnu';
    const bankName = acc.bank ? acc.bank.name : 'Banque inconnue';
    const statusClass = acc.status.toLowerCase();
    
    return `
      <tr data-id="${acc.id}">
        <td class="weight-semibold" style="font-family: monospace;">${acc.accountNumber}<br><small style="color: var(--text-secondary); font-family: 'Inter', sans-serif;">${bankName}</small></td>
        <td class="weight-semibold">${name}</td>
        <td>${email}</td>
        <td>${acc.accountType}</td>
        <td class="align-right weight-semibold">${formatCurrency(acc.balance)}</td>
        <td>
          <span class="badge ${statusClass}">${acc.status}</span>
        </td>
        <td>
          <div class="action-buttons-cell">
            <button class="btn-icon btn-action-deposit" title="Effectuer un dépôt" data-id="${acc.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="btn-icon btn-action-withdraw" title="Effectuer un retrait" data-id="${acc.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            <button class="btn-icon details btn-action-details" title="Détails & Historique" data-id="${acc.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </button>
            <button class="btn-icon delete btn-action-delete" title="Supprimer le compte" data-id="${acc.id}">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach event handlers to dynamic action buttons
  tbody.querySelectorAll('.btn-action-deposit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openDepositModal(btn.getAttribute('data-id'));
    });
  });

  tbody.querySelectorAll('.btn-action-withdraw').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openWithdrawModal(btn.getAttribute('data-id'));
    });
  });

  tbody.querySelectorAll('.btn-action-details').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openAccountDetails(btn.getAttribute('data-id'));
    });
  });

  tbody.querySelectorAll('.btn-action-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openDeleteModal(btn.getAttribute('data-id'));
    });
  });
}

/**
 * Open detailed page of a single account (Details and History)
 */
async function openAccountDetails(accountId) {
  const fullnameEl = document.getElementById('details-fullname');
  const numberEl = document.getElementById('details-acc-number');
  const emailEl = document.getElementById('details-email');
  const typeEl = document.getElementById('details-type');
  const createdAtEl = document.getElementById('details-created-at');
  const updatedAtEl = document.getElementById('details-updated-at');
  const balanceEl = document.getElementById('details-balance');
  const badgeEl = document.getElementById('details-status-badge');
  const avatarEl = document.getElementById('details-avatar');
  
  // Settings Form fields
  const formIdInput = document.getElementById('update-account-id');
  const formTypeSelect = document.getElementById('update-account-type');
  const formStatusSelect = document.getElementById('update-account-status');

  const transBody = document.getElementById('transactions-list-body');

  // Switch View first so user sees loading state
  showView('account-details');
  
  fullnameEl.textContent = 'Chargement...';
  numberEl.textContent = '...';
  transBody.innerHTML = `
    <tr>
      <td colspan="5" class="loading-state">
        <div class="spinner"></div>
        Chargement de l'historique...
      </td>
    </tr>
  `;

  try {
    // Fetch details & transactions in parallel
    const [accRes, transRes] = await Promise.all([
      api.getAccount(accountId),
      api.getTransactions(accountId),
    ]);

    if (accRes && accRes.success) {
      const acc = accRes.data;
      state.selectedAccount = acc;
      
      const userName = acc.user ? `${acc.user.firstName} ${acc.user.lastName}` : 'Inconnu';
      const initials = acc.user ? `${acc.user.firstName.charAt(0)}${acc.user.lastName.charAt(0)}`.toUpperCase() : 'XX';
      avatarEl.textContent = initials;
      fullnameEl.textContent = userName;
      numberEl.textContent = acc.accountNumber;
      emailEl.textContent = acc.user ? acc.user.email : 'Inconnu';
      typeEl.textContent = acc.accountType;
      createdAtEl.textContent = formatDate(acc.createdAt);
      updatedAtEl.textContent = formatDate(acc.updatedAt);
      balanceEl.textContent = formatCurrency(acc.balance);
      
      badgeEl.textContent = acc.status;
      badgeEl.className = `badge ${acc.status.toLowerCase()}`;

      // Prefill settings form
      formIdInput.value = acc.id;
      formTypeSelect.value = acc.accountType;
      formStatusSelect.value = acc.status;

      // Register quick actions button context
      document.getElementById('btn-details-deposit').onclick = () => openDepositModal(acc.id);
      document.getElementById('btn-details-withdraw').onclick = () => openWithdrawModal(acc.id);
    }

    if (transRes && transRes.success) {
      const transactions = transRes.data.transactions || [];
      if (transactions.length === 0) {
        transBody.innerHTML = `
          <tr>
            <td colspan="5" class="empty-state">
              Aucune transaction effectuée sur ce compte.
            </td>
          </tr>
        `;
      } else {
        // Sort newest first
        transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        transBody.innerHTML = transactions.map(t => {
          const badgeType = t.type.toLowerCase() === 'dépôt' ? 'dépôt' : 'retrait';
          const typeLabel = t.type;
          const amtSign = t.type.toLowerCase() === 'dépôt' ? '+' : '-';
          const amtClass = t.type.toLowerCase() === 'dépôt' ? 'color-success' : 'color-danger';
          
          return `
            <tr>
              <td class="weight-semibold" style="font-size: 0.85rem; color: var(--text-secondary); white-space: nowrap;">
                ${formatDate(t.timestamp)}
              </td>
              <td>
                <span class="badge ${badgeType}">${typeLabel}</span>
              </td>
              <td class="align-right weight-semibold ${amtClass}">
                ${amtSign}${formatCurrency(t.amount)}
              </td>
              <td class="align-right weight-semibold">
                ${formatCurrency(t.afterBalance)}
              </td>
              <td style="color: var(--text-secondary); font-size: 0.85rem;">
                ${t.description || '—'}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

  } catch (err) {
    showToast(err.message, 'error');
    fullnameEl.textContent = 'Erreur';
    numberEl.textContent = 'Erreur de chargement';
    transBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          Erreur de récupération des données.
        </td>
      </tr>
    `;
  }
}

// ================= MODALS STATE & HANDLERS =================

/**
 * Generic Open Modal helper
 */
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * Generic Close Modal helper
 */
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    // Reset forms inside if any
    const form = modal.querySelector('form');
    if (form) form.reset();
  }
}

/**
 * Deposit Modal Prep
 */
function openDepositModal(accountId) {
  const acc = state.accounts.find(a => a.id === accountId) || state.selectedAccount;
  if (!acc) return;

  if (acc.status !== 'Active') {
    showToast("Opération impossible : Le compte est bloqué ou fermé.", "warning");
    return;
  }

  document.getElementById('deposit-account-id').value = acc.id;
  const userName = acc.user ? `${acc.user.firstName} ${acc.user.lastName}` : 'Inconnu';
  document.getElementById('deposit-account-name').textContent = userName;
  document.getElementById('deposit-account-balance').textContent = formatCurrency(acc.balance);
  showModal('modal-deposit');
}

/**
 * Withdraw Modal Prep
 */
function openWithdrawModal(accountId) {
  const acc = state.accounts.find(a => a.id === accountId) || state.selectedAccount;
  if (!acc) return;

  if (acc.status !== 'Active') {
    showToast("Opération impossible : Le compte est bloqué ou fermé.", "warning");
    return;
  }

  document.getElementById('withdraw-account-id').value = acc.id;
  const userName = acc.user ? `${acc.user.firstName} ${acc.user.lastName}` : 'Inconnu';
  document.getElementById('withdraw-account-name').textContent = userName;
  document.getElementById('withdraw-account-balance').textContent = formatCurrency(acc.balance);
  showModal('modal-withdraw');
}

/**
 * Delete Modal Prep
 */
function openDeleteModal(accountId) {
  const acc = state.accounts.find(a => a.id === accountId);
  if (!acc) return;

  document.getElementById('delete-account-id').value = acc.id;
  const userName = acc.user ? `${acc.user.firstName} ${acc.user.lastName}` : 'Inconnu';
  document.getElementById('delete-account-name').textContent = userName;
  document.getElementById('delete-account-number').textContent = acc.accountNumber;
  showModal('modal-delete');
}

// ================= DOM EVENTS REGISTRATION =================

document.addEventListener('DOMContentLoaded', () => {
  // --- View Nav Switchers ---
  document.querySelectorAll('[data-view]').forEach(item => {
    item.addEventListener('click', () => {
      showView(item.getAttribute('data-view'));
    });
  });

  // --- Login & Register Routing ---
  document.getElementById('btn-show-register').addEventListener('click', () => showView('register'));
  document.getElementById('btn-show-login').addEventListener('click', () => showView('login'));
  document.getElementById('btn-logout').addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    state.user = null;
    showView('login');
  });

  // Login Form
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-password').value;
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await api.login(email, pwd);
      if (res && res.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        state.user = res.data.user;
        showToast("Connexion réussie", "success");
        e.target.reset();
        showView('dashboard');
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Register Form
  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const firstName = document.getElementById('register-firstname').value.trim();
    const lastName = document.getElementById('register-lastname').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await api.register(firstName, lastName, email, password);
      if (res && res.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        state.user = res.data.user;
        showToast("Inscription réussie !", "success");
        e.target.reset();
        showView('dashboard');
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.getElementById('btn-cancel-create').addEventListener('click', () => {
    showView('dashboard');
  });

  document.getElementById('btn-back-to-dashboard').addEventListener('click', () => {
    showView('dashboard');
  });

  // --- Search & Filters ---
  const searchInput = document.getElementById('search-input');
  const filterType = document.getElementById('filter-type');
  const filterStatus = document.getElementById('filter-status');

  const onFilterChange = () => {
    state.filters.search = searchInput.value;
    state.filters.type = filterType.value;
    state.filters.status = filterStatus.value;
    applyFilters();
    renderAccountsTable();
  };

  searchInput.addEventListener('input', onFilterChange);
  filterType.addEventListener('change', onFilterChange);
  filterStatus.addEventListener('change', onFilterChange);

  // --- Modal Cancel / Close Buttons ---
  document.querySelectorAll('.btn-close-modal, .btn-cancel-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) hideModal(modal.id);
    });
  });

  // Close modal when clicking on backdrop
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) hideModal(modal.id);
    });
  });

  // --- Form Submissions ---

  // Create Account Form
  document.getElementById('create-account-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    
    const accountData = {
      bankId: formData.get('bankId'),
      accountType: formData.get('accountType'),
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width: 14px; height: 14px; margin: 0; display: inline-block; vertical-align: middle;"></div> Création...';

    try {
      const res = await api.createAccount(accountData);
      if (res && res.success) {
        showToast("Compte bancaire créé avec succès !", "success");
        form.reset();
        showView('dashboard'); // Redirects and reloads
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnHTML;
    }
  });

  // Create Bank Form
  const createBankForm = document.getElementById('create-bank-form');
  if (createBankForm) {
    createBankForm.addEventListener('submit', async e => {
      e.preventDefault();
      const form = e.target;
      const name = document.getElementById('bank-name').value.trim();
      
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        const res = await api.createBank(name);
        if (res && res.success) {
          showToast("Banque créée avec succès !", "success");
          form.reset();
          loadBanks();
        }
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  // Deposit Form
  document.getElementById('deposit-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const id = document.getElementById('deposit-account-id').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const description = document.getElementById('deposit-description').value.trim() || 'Dépôt';

    if (isNaN(amount) || amount <= 0) {
      showToast("Veuillez saisir un montant supérieur à 0.", "warning");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await api.deposit(id, amount, description);
      if (res && res.success) {
        showToast(`Dépôt de ${formatCurrency(amount)} effectué avec succès !`, "success");
        hideModal('modal-deposit');
        
        // Refresh appropriate view
        if (state.currentView === 'account-details') {
          openAccountDetails(id);
        } else {
          loadAccounts();
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Withdraw Form
  document.getElementById('withdraw-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const id = document.getElementById('withdraw-account-id').value;
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const description = document.getElementById('withdraw-description').value.trim() || 'Retrait';

    if (isNaN(amount) || amount <= 0) {
      showToast("Veuillez saisir un montant supérieur à 0.", "warning");
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await api.withdraw(id, amount, description);
      if (res && res.success) {
        showToast(`Retrait de ${formatCurrency(amount)} effectué avec succès !`, "success");
        hideModal('modal-withdraw');
        
        // Refresh appropriate view
        if (state.currentView === 'account-details') {
          openAccountDetails(id);
        } else {
          loadAccounts();
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Update/Edit Settings Form
  document.getElementById('update-account-form').addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const id = document.getElementById('update-account-id').value;
    const accountType = document.getElementById('update-account-type').value;
    const status = document.getElementById('update-account-status').value;

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await api.updateAccount(id, { accountType, status });
      if (res && res.success) {
        showToast("Compte mis à jour avec succès !", "success");
        openAccountDetails(id); // Reload account details view
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Delete/Remove Form
  document.getElementById('delete-form').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('delete-account-id').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const res = await api.deleteAccount(id);
      if (res && res.success) {
        showToast("Compte supprimé avec succès.", "success");
        hideModal('modal-delete');
        loadAccounts(); // Refresh list
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
    }
  });

  // --- Initial Operations ---
  
  // Real-time API Connection monitoring (Every 8 seconds)
  checkApiConnection();
  setInterval(checkApiConnection, 8000);

  // Initial load
  if (!state.user) {
    showView('login');
  } else {
    showView('dashboard');
  }
});
