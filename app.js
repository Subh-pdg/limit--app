// app.js

// -------------------- IndexedDB Setup --------------------
let db;
const DB_NAME = 'LimitDB', DB_VERSION = 1;
const STORE_Q = 'questions', STORE_M = 'modules', STORE_U = 'userState';

function openDB() {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = e => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_Q)) {
      const qs = db.createObjectStore(STORE_Q, { keyPath: 'id', autoIncrement: true });
      qs.createIndex('tags', 'tags', { multiEntry: true });
    }
    if (!db.objectStoreNames.contains(STORE_M)) {
      const ms = db.createObjectStore(STORE_M, { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains(STORE_U)) {
      db.createObjectStore(STORE_U, { keyPath: 'moduleId' });
    }
    // Add a separate key for global user state (theme, etc.)
    if (!db.objectStoreNames.contains('globalState')) {
      db.createObjectStore('globalState', { keyPath: 'key' });
    }
  };
  req.onsuccess = e => { db = e.target.result; initApp(); };
  req.onerror = e => console.error('DB error', e);
}

// -------------------- Theme Persistence in IndexedDB --------------------
function saveThemeToDB(theme) {
  return new Promise((resolve, reject) => {
    if (!db) return resolve();
    const tx = db.transaction('globalState', 'readwrite');
    const store = tx.objectStore('globalState');
    store.put({ key: 'theme', value: theme });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getThemeFromDB() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve(null);
    const tx = db.transaction('globalState', 'readonly');
    const store = tx.objectStore('globalState');
    const req = store.get('theme');
    req.onsuccess = () => resolve(req.result ? req.result.value : null);
    req.onerror = () => resolve(null);
  });
}

// -------------------- Navigation --------------------
const pages = document.querySelectorAll('.page');
document.querySelectorAll('nav .nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    showPage(btn.dataset.page);
  });
});

function showPage(name) {
  pages.forEach(p => {
    if (p.id === name) {
      p.classList.add('active');
      if (name === 'questions' && !document.getElementById('question-list').children.length) {
        loadQuestionsList();
      }
      if (name === 'modules') {
        loadModulesManage();
      }
    } else {
      p.classList.remove('active');
    }
  });
  updateBreadcrumb(name);
}

function updateBreadcrumb(page, context) {
  const bc = document.getElementById('breadcrumb');
  if (!bc) return;
  let crumbs = [];
  if (page === 'home') {
    crumbs = ['Home'];
    bc.style.display = '';
  } else if (page === 'questions') {
    crumbs = ['<a href="#" onclick="showPage(\'home\')">Home</a>', 'Questions'];
    bc.style.display = '';
    if (context && context.action === 'add') {
      crumbs.push('Add Question');
    } else if (context && context.action === 'edit') {
      crumbs.push('Edit Question');
      if (context.tags && context.tags.length) {
        context.tags.forEach(t => crumbs.push(`<span class="tag">${t}</span>`));
      }
    }
  } else if (page === 'modules') {
    crumbs = ['<a href="#" onclick="showPage(\'home\')">Home</a>', 'Modules'];
    bc.style.display = '';
    if (context && context.action === 'create') {
      crumbs.push('Create Module');
    } else if (context && context.action === 'edit') {
      crumbs.push('Edit Module');
      if (context.moduleName) {
        crumbs.push(context.moduleName);
      }
    }
  } else if (page === 'quiz') {
    bc.style.display = 'none';
    return;
  } else {
    bc.style.display = 'none';
    return;
  }
  bc.innerHTML = crumbs.map((c, i) => i === 0 ? c : ` <span class="breadcrumb-arrow">›</span> ${c}`).join('');
}

// -------------------- Toast Utility --------------------
/**
 * Shows a toast notification
 * @param {string|object} message - The message to display (string) or an object with title and content
 * @param {string} type - Type of toast ('info', 'success', 'error', 'warning')
 * @param {number} duration - Duration in milliseconds (default: 4000ms)
 * @returns {HTMLElement} The created toast element
 */
function toast(message, type = 'info', duration = 4000) {
  // Get or create container
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.style.position = 'fixed';
    container.style.bottom = '1.5rem';
    container.style.left = '1.5rem';
    container.style.zIndex = '1000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column-reverse';
    container.style.gap = '0.75rem';
    container.style.maxWidth = 'calc(100% - 3rem)';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }
  
  // Create toast element
  const toastElement = document.createElement('div');
  toastElement.className = `toast ${type}`;
  toastElement.setAttribute('role', 'alert');
  toastElement.setAttribute('aria-live', 'polite');
  
  // Create icon
  const icon = document.createElement('div');
  icon.className = 'icon';
  icon.innerHTML = getToastIcon(type);
  
  // Create message container
  const messageContainer = document.createElement('div');
  messageContainer.className = 'message';
  
  // Handle different message formats (string or object)
  if (typeof message === 'string') {
    messageContainer.innerHTML = `<div class="message-content">${message}</div>`;
  } else if (typeof message === 'object' && message !== null) {
    const title = message.title ? `<div class="message-title">${message.title}</div>` : '';
    const content = message.content ? `<div class="message-content">${message.content}</div>` : '';
    messageContainer.innerHTML = `${title}${content}`;
  }
  
  // Create close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  
  // Create progress bar
  const progress = document.createElement('div');
  progress.className = 'toast-progress';
  
  // Assemble toast
  toastElement.appendChild(icon);
  toastElement.appendChild(messageContainer);
  toastElement.appendChild(closeBtn);
  toastElement.appendChild(progress);
  
  // Add to container at the top of the stack
  container.insertBefore(toastElement, container.firstChild);
  
  // Trigger reflow for animation
  void toastElement.offsetWidth;
  
  // Show toast with animation
  toastElement.classList.add('show');
  
  // Auto-dismiss
  let dismissTimeout = setTimeout(() => {
    dismissToast(toastElement, container);
  }, duration);
  
  // Pause auto-dismiss on hover
  toastElement.addEventListener('mouseenter', () => {
    clearTimeout(dismissTimeout);
    if (progress) {
      progress.style.animationPlayState = 'paused';
    }
  });
  
  // Resume auto-dismiss when mouse leaves
  toastElement.addEventListener('mouseleave', () => {
    if (progress && progress.parentElement) {
      const remaining = (1 - (progress.offsetWidth / progress.parentElement.offsetWidth)) * duration;
      progress.style.animation = `toastProgress ${remaining}ms linear forwards`;
      
      dismissTimeout = setTimeout(() => {
        dismissToast(toastElement, container);
      }, remaining);
    }
  });
  
  // Manual dismiss on close button
  closeBtn.addEventListener('click', () => {
    clearTimeout(dismissTimeout);
    dismissToast(toastElement, container);
  });
  
  // Start progress bar animation
  if (progress) {
    progress.style.animation = `toastProgress ${duration}ms linear forwards`;
  }
  
  // Focus management for accessibility
  toastElement.focus();
  
  return toastElement;
}

/**
 * Returns SVG icon markup based on toast type
 * @param {string} type - Type of toast
 * @returns {string} SVG icon markup
 */
function getToastIcon(type) {
  const icons = {
    success: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`,
    error: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`,
    warning: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`,
    info: `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`
  };
  
  return icons[type] || icons.info;
}

function dismissToast(toast, container) {
  if (!toast) return;
  
  // Add hide class to trigger fade out
  toast.classList.add('hide');
  
  // Remove toast after animation completes
  setTimeout(() => {
    if (toast && toast.parentNode === container) {
      container.removeChild(toast);
    }
    
    // Remove container if empty
    if (container && container.children.length === 0 && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }, 300);
}

// -------------------- Modal Utility --------------------
function openModal(title, bodyHTML, footerBtns = []) {
  // Only set modal body, no header/footer
  const modalBody = document.getElementById('modal-body');
  modalBody.innerHTML = '';
  // Title (if needed)
  if (title) {
    const titleEl = document.createElement('h3');
    titleEl.textContent = title;
    titleEl.style.marginBottom = '1.5rem';
    modalBody.appendChild(titleEl);
  }
  // Body content
  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = bodyHTML;
  modalBody.appendChild(contentDiv);
  // Action buttons (if any)
  if (footerBtns && footerBtns.length) {
    const btnBar = document.createElement('div');
    btnBar.style.display = 'flex';
    btnBar.style.justifyContent = 'flex-end';
    btnBar.style.gap = '1rem';
    btnBar.style.marginTop = '2rem';
    footerBtns.forEach(b => {
      const btn = document.createElement('button');
      btn.textContent = b.text;
      btn.className = b.class || 'btn';
      btn.addEventListener('click', () => {
        if (typeof b.onClick === 'function') b.onClick();
        if (b.close) closeModal();
      });
      btnBar.appendChild(btn);
    });
    modalBody.appendChild(btnBar);
  }
  document.getElementById('modal-backdrop').style.display = 'flex';
  setTimeout(() => {
    const firstInput = document.querySelector('#modal-body input, #modal-body button');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeModal() {
  const backdrop = document.getElementById('modal-backdrop');
  backdrop.style.opacity = '0';
  setTimeout(() => {
    backdrop.style.display = 'none';
    backdrop.style.opacity = '1';
  }, 200);
}

// Close modal on backdrop click
document.getElementById('modal-backdrop').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('modal-backdrop').style.display === 'flex') {
    closeModal();
  }
});

// -------------------- Home: List & Start Modules --------------------
// Keep track of the last time loadModulesHome was called
let lastLoadModulesHomeCall = 0;

// Helper functions for exam module display
function getExamButtonText(m, done = [], total = 0) {
  if (m.type !== 'exam') {
    // Regular quiz module
    return done.length === total ? 'Restart' : done.length > 0 ? 'Continue' : 'Start';
  }
  
  // Exam module logic
  if (m.examCompleted) {
    return 'View Scores';
  }
  
  // Check exam timing
  const now = new Date();
  const examStart = new Date(m.examDate + 'T' + m.examTime);
  const examEnd = new Date(examStart.getTime() + m.examDuration * 60000);
  
  if (now < examStart) {
    return 'Not Available Yet';
  } else if (now > examEnd) {
    return 'Exam Ended';
  } else {
    return 'Start Exam';
  }
}

function getExamButtonAttributes(m) {
  if (m.type !== 'exam') {
    return `onclick="startModule(${m.id})"`;
  }
  
  // Exam module logic
  if (m.examCompleted) {
    return `id="view-scores-btn-${m.id}"`;
  }
  
  // Check exam timing
  const now = new Date();
  const examStart = new Date(m.examDate + 'T' + m.examTime);
  const examEnd = new Date(examStart.getTime() + m.examDuration * 60000);
  
  if (now < examStart || now > examEnd) {
    return 'disabled';
  } else {
    return `onclick="startModule(${m.id})"`;
  }
}

function loadModulesHome() {
  const now = Date.now();
  // Prevent multiple rapid calls
  if (now - lastLoadModulesHomeCall < 1000) {
    console.log('Skipping duplicate loadModulesHome call');
    return;
  }
  lastLoadModulesHomeCall = now;
  
  console.log('loadModulesHome called from:', new Error().stack);
  console.log('loadModulesHome called');
  const list = document.getElementById('module-list');
  if (!list) {
    console.error('module-list element not found');
    return;
  }
  
  list.innerHTML = '<div class="spinner"></div>';
  
  const tx = db.transaction([STORE_M, STORE_U], 'readonly');
  const moduleStore = tx.objectStore(STORE_M);
  
  // Get all modules
  const moduleRequest = moduleStore.getAll();
  
  moduleRequest.onsuccess = async () => {
    console.log('Raw modules from DB:', moduleRequest.result);
    
    // Create a map to ensure unique modules by ID
    const modulesMap = new Map();
    
    // Process modules - last one with a given ID wins
    moduleRequest.result.forEach(module => {
      if (!module.locked) {
        modulesMap.set(module.id, module);
      }
    });
    
    let uniqueModules = Array.from(modulesMap.values());
    console.log('Unique modules after deduplication:', uniqueModules);
    
    // Filter out hidden exam modules
    uniqueModules = uniqueModules.filter(m => !m.hidden);
    
    if (uniqueModules.length === 0) {
      list.innerHTML = '<div class="empty-state">No modules available yet.</div>';
      return;
    }
    
    // Sort modules by ID in descending order (newest first)
    uniqueModules.sort((a, b) => b.id - a.id);
    
    // Clear the list and populate with unique modules
    list.innerHTML = '';
    console.log('Rendering', uniqueModules.length, 'modules');
    
    // Process each module to get user progress
    for (const m of uniqueModules) {
      // Exam: check if answer viewing window is over
      if (m.type === 'exam' && m.examCompleted) {
        const examStart = new Date(m.examDate + 'T' + m.examTime);
        const examEnd = new Date(examStart.getTime() + m.examDuration * 60000);
        const viewWindowEnd = new Date(examEnd.getTime() + m.examDuration * 60000 / 2);
        const now = new Date();
        if (now > viewWindowEnd) {
          // Hide from home
          continue;
        }
      }
      const userState = await getUserState(m.id);
      const done = userState.done || [];
      const total = m.questions.length;
      const correct = done.filter(d => d.correct).length;
      const percent = total > 0 ? Math.round((done.length / total) * 100) : 0;
      const accuracy = done.length > 0 ? Math.round((correct / done.length) * 100) : 0;
      const card = document.createElement('div');
      card.className = 'card module-card-home';
      card.style.background = 'var(--card-bg)';
      card.style.borderRadius = 'var(--radius-lg)';
      card.style.boxShadow = 'var(--card-shadow)';
      card.style.transition = 'box-shadow var(--transition), background var(--transition)';
      card.style.overflow = 'hidden';
      card.style.position = 'relative';
      card.onmouseover = () => {
        card.style.boxShadow = 'var(--card-shadow-hover)';
        card.style.background = 'var(--card-hover)';
      };
      card.onmouseout = () => {
        card.style.boxShadow = 'var(--card-shadow)';
        card.style.background = 'var(--card-bg)';
      };
      card.innerHTML = `
        <div class="module-card-content" style="padding:2.5rem 2.5rem 2rem 2.5rem;">
          <div class="card-header" style="background:none;">
            <div class="module-card-badge" style="background:var(--primary-light);color:var(--primary-dark);font-size:0.9rem;font-weight:600;padding:0.35rem 0.9rem;border-radius:50px;box-shadow:0 2px 8px rgba(30,64,175,0.08);">${total} Questions</div>
            <div class="card-title" style="font-size:1.5rem;margin:0.5rem 0 0.75rem;color:var(--text-primary);font-weight:700;line-height:1.3;">${m.name}</div>
            <div class="card-desc" style="color:var(--text-secondary);font-size:0.95rem;line-height:1.5;margin:0;">${m.description}</div>
          </div>
        </div>
        <div class="card-actions" style="background:none;box-shadow:none;">
          <button class="start-btn" style="display:block;width:100%;font-size:1.2rem;font-weight:700;padding:1.2rem 0;border-radius:2rem;background:linear-gradient(90deg,var(--primary) 0%,var(--primary-light) 100%);color:#fff;box-shadow:0 2px 8px rgba(30,64,175,0.10);border:none;transition:background 0.2s,box-shadow 0.2s,transform 0.15s;letter-spacing:0.01em;" onmouseover="this.style.background='linear-gradient(90deg,var(--primary-light) 0%,var(--primary) 100%)';this.style.boxShadow='0 8px 32px rgba(30,64,175,0.18)';this.style.transform='translateY(-2px) scale(1.02)';" onmouseout="this.style.background='linear-gradient(90deg,var(--primary) 0%,var(--primary-light) 100%)';this.style.boxShadow='0 2px 8px rgba(30,64,175,0.10)';this.style.transform='none';" ${getExamButtonAttributes(m)}>
            ${getExamButtonText(m, done, total)}
          </button>
        </div>
      `;
      list.append(card);
      // Attach view scores handler if needed
      if (m.type === 'exam' && m.examCompleted) {
        setTimeout(() => {
          const btn = document.getElementById('view-scores-btn-' + m.id);
          if (btn) btn.onclick = () => handleViewScores(m.id);
        }, 0);
      }
    }
  };
}

// Save/load user quiz state
function getUserState(mid) {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_U, 'readonly');
      const store = tx.objectStore(STORE_U);
      const request = store.get(mid);
      
      request.onsuccess = (e) => {
        const result = e.target.result;
        if (result) {
          resolve({
            moduleId: result.moduleId || mid,
            done: Array.isArray(result.done) ? result.done : [],
            currentQuestion: result.currentQuestion || 0,
            score: result.score || 0,
            timestamp: result.timestamp || new Date().toISOString()
          });
        } else {
          // Return default state if no record exists
          resolve({
            moduleId: mid,
            done: [],
            currentQuestion: 0,
            score: 0,
            timestamp: new Date().toISOString()
          });
        }
      };
      
      request.onerror = (e) => {
        console.error('Error getting user state:', e);
        // Return default state on error
        resolve({
          moduleId: mid,
          done: [],
          currentQuestion: 0,
          score: 0,
          timestamp: new Date().toISOString()
        });
      };
    } catch (error) {
      console.error('Error in getUserState:', error);
      // Return default state on error
      resolve({
        moduleId: mid,
        done: [],
        currentQuestion: 0,
        score: 0,
        timestamp: new Date().toISOString()
      });
    }
  });
}

function saveUserState(state) {
  return new Promise((resolve, reject) => {
    try {
      // If state has moduleId and questions, set completed flag
      if (state.moduleId && Array.isArray(state.done) && state.totalQuestions !== undefined) {
        state.completed = state.done.length >= state.totalQuestions;
      }
      const tx = db.transaction(STORE_U, 'readwrite');
      const store = tx.objectStore(STORE_U);
      store.put(state);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e);
    } catch (error) {
      reject(error);
    }
  });
}

// Quiz Logic
let currentModule, quizQuestions, quizState;

// --- Shuffle questions if module.shuffle is true ---
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Update startModule to shuffle questions if needed
function startModule(mid) {
  currentModule = mid;
  getModuleById(mid).then(m => {
    // Exam: check if completed or not openable
    if (m.type === 'exam') {
      if (m.examCompleted) {
        toast('This exam has already been submitted and cannot be reopened.', 'error');
        showPage('home');
        return;
      }
      // Check if exam is openable (date/time window)
      const now = new Date();
      const examStart = new Date(m.examDate + 'T' + m.examTime);
      const examEnd = new Date(examStart.getTime() + m.examDuration * 60000);
      if (now < examStart) {
        toast('This exam is not open yet.', 'warning');
        showPage('home');
        return;
      }
      if (now > examEnd) {
        toast('This exam is over.', 'error');
        showPage('home');
        return;
      }
    }
    // Prevent re-attempting completed exam questions by any means
    if (m.type === 'exam' && m.examCompleted) {
      toast('This exam has already been submitted and cannot be reopened.', 'error');
      showPage('home');
      return;
    }
    getUserState(mid).then(state => {
      quizState = {
        moduleId: mid,
        done: Array.isArray(state?.done) ? state.done : [],
        currentQuestion: 0,
        score: state?.score || 0,
        timestamp: new Date().toISOString(),
        totalQuestions: m.questions.length,
        completed: false,
        examAnswers: [],
        isExam: m.type === 'exam',
        examStart: m.examDate + 'T' + m.examTime,
        examDuration: m.examDuration,
        examTimer: null
      };
      quizQuestions = Array.isArray(m.questions) ? m.questions : [];
      if (m.shuffle && quizQuestions.length > 0) {
        quizQuestions = shuffleArray([...quizQuestions]);
      }
      if (quizQuestions.length === 0) {
        showPage('quiz');
        showCompletionMessage(mid, Math.round((quizState.done.filter(d => d.correct).length / m.questions.length) * 100));
        return;
      }
      showPage('quiz');
      if (quizState.isExam) {
        startExamTimer();
        renderExam();
        // Auto-submit on navigation/close
        window.addEventListener('beforeunload', autoSubmitExamOnUnload);
        window.addEventListener('popstate', autoSubmitExamOnUnload);
      } else {
        renderQuiz();
      }
    }).catch(error => {
      quizState = {
        moduleId: mid,
        done: [],
        currentQuestion: 0,
        score: 0,
        timestamp: new Date().toISOString(),
        examAnswers: [],
        isExam: m.type === 'exam',
        examStart: m.examDate + 'T' + m.examTime,
        examDuration: m.examDuration,
        examTimer: null
      };
      showPage('quiz');
      if (quizState.isExam) {
        startExamTimer();
        renderExam();
        window.addEventListener('beforeunload', autoSubmitExamOnUnload);
        window.addEventListener('popstate', autoSubmitExamOnUnload);
      } else {
        renderQuiz();
      }
    });
  }).catch(error => {
    toast('Failed to load module. Please try again.', 'error');
  });
}

function getModuleById(mid) {
  return new Promise(res => {
    const tx = db.transaction(STORE_M, 'readonly'), store = tx.objectStore(STORE_M);
    store.get(mid).onsuccess = e => res(e.target.result);
  });
}

// 1. Spinner overlay utility
function showSpinnerOverlay() {
  let overlay = document.getElementById('spinner-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'spinner-overlay';
    overlay.className = 'spinner-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}
function hideSpinnerOverlay() {
  const overlay = document.getElementById('spinner-overlay');
  if (overlay) overlay.style.display = 'none';
}

// 2. In renderQuiz, show spinner before loading each question
async function renderQuiz() {
  const container = document.getElementById('quiz-content');
  container.innerHTML = '';
  showSpinnerOverlay();
  setTimeout(() => {
    hideSpinnerOverlay();
  // Get all question IDs that haven't been answered yet
  const doneIds = new Set(quizState.done.map(d => d.id));
  const unansweredQuestions = quizQuestions.filter(qId => !doneIds.has(qId));
  
  // If no more questions, show completion
  if (unansweredQuestions.length === 0) {
    quizState.completed = true;
    saveUserState(quizState);
    showCompletionMessage(currentModule, Math.round((quizState.done.filter(d => d.correct).length / quizQuestions.length) * 100));
    return;
  }
  
  // Get the next question (first in the unanswered list)
  const next = unansweredQuestions[0];
  
  // Update progress indicators
  const total = quizQuestions.length;
  const done = quizState.done.length;
  const correct = quizState.done.filter(d => d.correct).length;
  
  document.getElementById('progress-count-text').textContent = `${done}/${total}`;
  document.getElementById('progress-accuracy-text').textContent = `${Math.round((correct/Math.max(done, 1))*100)}%`;
  
  document.getElementById('progress-count').style.width = `${(done/total)*100}%`;
  document.getElementById('progress-accuracy').style.width = `${(correct/Math.max(done, 1))*100}%`;
  
  // Add back to home button
  container.innerHTML = `
    <div class="quiz-header">
      <button class="btn btn-secondary" onclick="confirmExitQuiz()">
        <img src="icons/Back.svg" alt=""> Back to Home
      </button>
    </div>
  `;
  
  // No need for this check anymore as we handle it above
  // with the unansweredQuestions check
  
  getQuestionById(next).then(q => {
    container.innerHTML += `
      <div class="quiz-question">
        <div class="question-number">Question ${done + 1} of ${total}</div>
        <div class="question-text">${applyFontDelimiters(q.text)}</div>
      </div>
    `;
    // Render KaTeX as inline math (no rectangle, no toolbar) for question text
    const questionTextDiv = container.querySelector('.question-text');
    renderKatexInline(questionTextDiv);
    // Detect if answer is rich text or uses math font or KaTeX
    const isRich = /<sup>|<sub>|<span class="math-font"|<b>|<i>|<u>|<br|<ul|<ol|<li|<img|<div|<p|&nbsp;|katex-equation/.test(q.answer);
      const usesMathFont = /class=["']math-font["']/.test(q.answer);
    const usesKatex = /katex-equation|\\\(|\\\)|\\\[|\\\]|\$\$|\$/.test(q.answer);
    if (q.type === 'typed') {
      if (isRich || usesKatex) {
      container.innerHTML += `
          <div class="answer-input" style="flex-direction:column;align-items:stretch;">
            <div id="typed-answer" class="form-control${usesMathFont ? ' math-font' : ''}" contenteditable="true" placeholder="Type your answer..." style="min-height:2.2rem;"></div>
            <button class="btn" id="submit-typed" style="margin-top:1em;align-self:flex-end;">
            <img src="icons/Check.svg" alt=""> Submit Answer
          </button>
        </div>
      `;
        } else {
          container.innerHTML += `
            <div class="answer-input">
              <input id="typed-answer" class="form-control" placeholder="Type your answer...">
              <button class="btn" id="submit-typed">
                <img src="icons/Check.svg" alt=""> Submit Answer
              </button>
            </div>
          `;
        }
      const input = document.getElementById('typed-answer');
      input.focus();
        if (usesMathFont) input.classList.add('math-font');
      if (typeof q.answer === 'string' && /[∫∑∏√∞≈≠≤≥∂∇∃∀∈∉∋αβγδεζηθικλμνξοπρστυφχψω]|math-font/.test(q.answer)) {
        input.classList.add('math-font');
      }
      input.addEventListener('keydown', function(e) {
        if (e.key === '^') {
          e.preventDefault();
          document.execCommand('superscript', false, null);
        }
        if (e.key === '_') {
          e.preventDefault();
          document.execCommand('subscript', false, null);
        }
      });
      document.getElementById('submit-typed').addEventListener('click', () => {
        let ans;
        if (isRich || usesKatex) {
          ans = input.innerHTML.trim();
        } else {
          ans = input.value.trim();
        }
        if (!ans) {
          toast('Please enter an answer', 'error');
          input.focus();
          return;
        }
        let correct = false;
        // --- PATCH: KaTeX answer comparison ---
        if (typeof q.answer === 'string') {
          // If both answers are a single KaTeX equation span, compare their data-latex
          const userKatex = ans.match(/^<span class=["']katex-equation["'][^>]*data-latex=["']([^"']+)["'][^>]*>.*<\/span>$/);
          const correctKatex = q.answer.match(/^<span class=["']katex-equation["'][^>]*data-latex=["']([^"']+)["'][^>]*>.*<\/span>$/);
          let userExpr = null, correctExpr = null;
          // Try to extract LaTeX if present, else use plain math
          if (userKatex) {
            userExpr = userKatex[1];
          } else {
            userExpr = ans;
          }
          if (correctKatex) {
            correctExpr = correctKatex[1];
          } else {
            correctExpr = q.answer;
          }
          // Normalize both for MathJS
          const userNorm = normalizeMathInput(userExpr);
          const correctNorm = normalizeMathInput(correctExpr);
          // Try to use MathJS to compare
          try {
            const userMath = math.simplify(userNorm);
            const correctMath = math.simplify(correctNorm);
            // Compare using math.equal (robust for commutative property)
            if (math.equal(userMath, correctMath)) {
              correct = true;
            } else {
              // Try numeric evaluation at a random value
              const scope = {x: 2, y: 3, z: 4};
              const userVal = userMath.evaluate(scope);
              const correctVal = correctMath.evaluate(scope);
              if (Math.abs(userVal - correctVal) < 1e-9) {
                correct = true;
              }
            }
          } catch (err) {
            // Fallback to old comparison if parsing fails
            const userKatex = ans.match(/^<span class=["']katex-equation["'][^>]*data-latex=["']([^"']+)["'][^>]*>.*<\/span>$/);
            const correctKatex = q.answer.match(/^<span class=["']katex-equation["'][^>]*data-latex=["']([^"']+)["'][^>]*>.*<\/span>$/);
            if (userKatex && correctKatex) {
              correct = userKatex[1].replace(/\s+/g, '') === correctKatex[1].replace(/\s+/g, '');
            } else {
              correct = normalizeAnswer(ans) === normalizeAnswer(q.answer);
            }
          }
        }
        showFeedback(q, correct, ans);
      });
    } else {
      const ul = document.createElement('ul');
      ul.className = 'quiz-options';
      q.options.forEach((opt, i) => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.innerHTML = `${String.fromCharCode(65 + i)}. <span class="option-text${needsMathFont(opt) ? ' math-font' : ''}">${applyFontDelimiters(opt)}</span>`;
        if (needsMathFont(opt)) btn.classList.add('math-font');
        btn.addEventListener('click', () => {
          const correct = (i === q.correctIndex);
          showFeedback(q, correct, i);
        });
        li.append(btn);
        ul.append(li);
      });
      container.append(ul);
      // Render KaTeX as inline math (no rectangle, no toolbar) for MCQ options
      renderKatexInline(ul);
    }
  });
  }, 500);
}

// Helper: Render KaTeX as inline math (no rectangle, no toolbar)
function renderKatexInline(container) {
  if (!container) return;
  // Replace all .katex-equation spans with just their LaTeX rendered inline
  container.querySelectorAll('span.katex-equation[data-latex]').forEach(span => {
    const latex = span.getAttribute('data-latex');
    const inline = document.createElement('span');
    try {
      katex.render(latex, inline, { throwOnError: false, displayMode: false });
    } catch (e) {
      inline.innerHTML = '<span style="color:red">Invalid LaTeX</span>';
    }
    // Copy formatting styles from .katex-equation to inline
    if (span.classList.contains('bold')) inline.style.fontWeight = 'bold';
    if (span.classList.contains('italic')) inline.style.fontStyle = 'italic';
    if (span.classList.contains('underline')) inline.style.textDecoration = (inline.style.textDecoration ? inline.style.textDecoration + ' ' : '') + 'underline';
    if (span.classList.contains('strikethrough')) inline.style.textDecoration = (inline.style.textDecoration ? inline.style.textDecoration + ' ' : '') + 'line-through';
    if (span.style.fontSize) inline.style.fontSize = span.style.fontSize;
    span.replaceWith(inline);
  });
}

// 3. Fix answer comparison for superscript/subscript
function normalizeAnswer(html) {
  // Convert <sup> and <sub> to Unicode, strip other tags
  let text = html
    .replace(/<sup>(.*?)<\/sup>/gi, (_, x) => toSuperscript(x))
    .replace(/<sub>(.*?)<\/sub>/gi, (_, x) => toSubscript(x))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Also convert any Unicode superscript/subscript to normal for comparison
  text = text
    .replace(/[\u2070-\u209F]/g, c => fromSuperSub(c));
  return text;
}

// Helper: Convert Unicode superscript/subscript to normal
function fromSuperSub(char) {
  const superMap = {
    '\u2070': '0', '\u00b9': '1', '\u00b2': '2', '\u00b3': '3',
    '\u2074': '4', '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9',
    '\u207a': '+', '\u207b': '-', '\u207c': '=', '\u207d': '(', '\u207e': ')', 'ⁿ': 'n'
  };
  const subMap = {
    '\u2080': '0', '\u2081': '1', '\u2082': '2', '\u2083': '3', '\u2084': '4', '\u2085': '5', '\u2086': '6', '\u2087': '7', '\u2088': '8', '\u2089': '9',
    '\u208a': '+', '\u208b': '-', '\u208c': '=', '\u208d': '(', '\u208e': ')'
  };
  if (superMap[char]) return superMap[char];
  if (subMap[char]) return subMap[char];
  return char;
}

function toSuperscript(str) {
  const map = {'0':' b9','1':' b2','2':' b3','3':' b3','4':'074','5':'075','6':'076','7':'077','8':'078','9':'079','+':'07A','-':'07B','=':'07C','(':'07D',')':'07E','n':'07F'};
  return str.split('').map(c => map[c] || c).join('');
}
function toSubscript(str) {
  const map = {'0':'080','1':'081','2':'082','3':'083','4':'084','5':'085','6':'086','7':'087','8':'088','9':'089','+':'08A','-':'08B','=':'08C','(':'08D',')':'08E'};
  return str.split('').map(c => map[c] || c).join('');
}

function showFeedback(q, correct, given) {
  // Store the answer in the quiz state
  quizState.done.push({ 
    id: q.id, 
    correct,
    answer: given 
  });

  // Debug: Log explanation presence
  console.log('showFeedback: explanation for q.id', q.id, 'is', q.explanation);

  const c = document.getElementById('quiz-content');
  c.innerHTML = `
    <div class="quiz-header" style="margin-bottom: 1.5rem;">
      <button class="btn btn-secondary" onclick="confirmExitQuiz()">
        <img src="icons/Back.svg" alt=""> Back to Home
      </button>
    </div>
  `;

  // --- Question at the top ---
  const questionBox = document.createElement('div');
  questionBox.className = 'quiz-question';
  // Detect if math font is needed for question text
  const mathFontClass = needsMathFont(q.text) ? 'math-font' : '';
  questionBox.innerHTML = `
    <div class="question-number">Question Feedback</div>
    <div class="question-text ${mathFontClass}">${applyFontDelimiters(q.text)}</div>
  `;
  renderKatexInline(questionBox);
  c.append(questionBox);

  // --- Feedback rectangle ---
  const fb = document.createElement('div');
  fb.className = 'feedback ' + (correct ? 'correct' : 'incorrect');
  fb.innerHTML = `
    <div class="feedback-content" style="backdrop-filter: blur(16px); background: rgba(255,255,255,0.45); border-radius: 2rem; box-shadow: 0 8px 32px rgba(32, 178, 170, 0.18); border: 1.5px solid rgba(32,178,170,0.18);">
      <div class="feedback-header" style="display: flex; align-items: center; gap: 1.2rem;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:3.2rem;height:3.2rem;border-radius:50%;background:${correct ? 'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)' : 'linear-gradient(135deg,#ff5858 0%,#f09819 100%)'};box-shadow:0 2px 12px rgba(32,178,170,0.12);font-size:2rem;animation:${correct ? 'popIn 0.5s' : 'shake 0.5s'};color:#fff;">
          ${correct ? '\u2714' : '\u2716'}
        </span>
        <div>
          <strong style="font-size:1.35rem;letter-spacing:-0.01em;">${correct ? 'Correct!' : 'Incorrect'}</strong>
          <div class="feedback-body" style="font-size:1.1rem;color:var(--text-secondary);margin-top:0.25rem;">
            ${correct ? 'Great job! Your answer is correct.' : 'Sorry, your answer is incorrect.'}
          </div>
        </div>
      </div>
    </div>
  `;
  // --- Next button ---
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn next-btn';
  nextBtn.style.margin = '2.5rem auto 0 auto';
  nextBtn.style.display = 'flex';
  nextBtn.style.alignItems = 'center';
  nextBtn.style.justifyContent = 'center';
  nextBtn.style.gap = '0.7rem';
  nextBtn.style.fontSize = '1.25rem';
  nextBtn.style.fontWeight = '600';
  nextBtn.style.padding = '1.1rem 2.5rem';
  nextBtn.style.borderRadius = '2rem';
  nextBtn.style.background = 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)';
  nextBtn.style.color = '#fff';
  nextBtn.style.boxShadow = '0 4px 18px rgba(67,233,123,0.13)';
  nextBtn.style.border = 'none';
  nextBtn.style.transition = 'background 0.2s, box-shadow 0.2s, transform 0.15s';
  nextBtn.onmouseover = () => {
    nextBtn.style.background = 'linear-gradient(90deg, #38f9d7 0%, #43e97b 100%)';
    nextBtn.style.boxShadow = '0 8px 32px rgba(67,233,123,0.18)';
    nextBtn.style.transform = 'translateY(-2px) scale(1.03)';
  };
  nextBtn.onmouseout = () => {
    nextBtn.style.background = 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)';
    nextBtn.style.boxShadow = '0 4px 18px rgba(67,233,123,0.13)';
    nextBtn.style.transform = 'none';
  };
  nextBtn.innerHTML = '<span>Next Question</span> <img src="icons/Arrow Right.svg" alt="" style="width:1.7rem;height:1.7rem;vertical-align:middle;">';
  nextBtn.addEventListener('click', async () => {
    try {
      await saveUserState(quizState);
      renderQuiz();
    } catch (error) {
      console.error('Error saving quiz state:', error);
      toast('Error saving progress. Please try again.', 'error');
    }
  });
  fb.append(nextBtn);
  c.append(fb);

  // --- Comparison rectangle ---
  const comp = document.createElement('div');
  comp.className = 'feedback-comparison';
  comp.style.marginTop = '2.5rem';
  comp.style.background = 'rgba(255,255,255,0.55)';
  comp.style.backdropFilter = 'blur(18px)';
  comp.style.border = '2.5px solid rgba(32,178,170,0.13)';
  comp.style.borderRadius = '2.5rem';
  comp.style.boxShadow = '0 8px 32px rgba(32,178,170,0.13)';
  comp.style.padding = '2.5rem 2.5rem';
  comp.style.width = '95%';
  comp.style.maxWidth = '950px';
  comp.style.margin = '2.5rem auto';
  comp.style.boxSizing = 'border-box';
  comp.style.transition = 'all 0.4s cubic-bezier(.4,0,.2,1)';

  if (q.type === 'typed') {
    // Typed answer: show correct and user answer
    const correctNeedsMathFont = needsMathFont(q.answer);
    const userNeedsMathFont = needsMathFont(given);
    comp.innerHTML = `
      <div style="display: flex; gap: 2.5rem; flex-wrap: wrap; justify-content: center;">
        <div class="answer-section correct-answer${correctNeedsMathFont ? ' math-font' : ''}" style="flex:1;min-width:220px;background:rgba(67,233,123,0.08);border-radius:1.5rem;padding:1.5rem;box-shadow:0 2px 8px rgba(67,233,123,0.08);">
          <h4 style="color:var(--success);margin-bottom:0.5rem;">Correct Answer</h4>
          <div>${applyFontDelimiters(q.answer)}</div>
        </div>
        <div class="answer-section user-answer${correct ? ' correct' : ' incorrect'}${userNeedsMathFont ? ' math-font' : ''}" style="flex:1;min-width:220px;background:${correct ? 'rgba(67,233,123,0.08)' : 'rgba(255,88,88,0.08)'};border-radius:1.5rem;padding:1.5rem;box-shadow:0 2px 8px rgba(255,88,88,0.08);">
          <h4 style="color:${correct ? 'var(--success)' : 'var(--error)'};margin-bottom:0.5rem;">Your Answer</h4>
          <div>${applyFontDelimiters(given)}</div>
        </div>
      </div>
    `;
    renderKatexInline(comp);
  } else {
    // --- MCQ: show all options as long rectangles stacked vertically ---
    comp.innerHTML = `<div class="mcq-options-vertical" style="display:flex;flex-direction:column;gap:1.2rem;">${q.options.map((option, index) => {
      const isCorrectOption = index === q.correctIndex;
      const isUserChoice = (given !== null && given !== undefined && Number(given) === index);
      let cardStyle = [
        'padding:1.5rem 2rem',
        'border-radius:1.5rem',
        'background:' + (isCorrectOption ? 'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)' : isUserChoice ? 'linear-gradient(135deg,#ff5858 0%,#f09819 100%)' : 'rgba(255,255,255,0.7)'),
        'color:' + (isCorrectOption || isUserChoice ? '#fff' : 'var(--text-primary)'),
        'box-shadow:0 2px 12px rgba(32,178,170,0.10)',
        'position:relative',
        'transition:all 0.3s cubic-bezier(.4,0,.2,1)'
      ];
      let badge = '';
      if (isCorrectOption) badge = `<span style=\"position:absolute;top:1rem;right:1.5rem;background:rgba(67,233,123,0.95);color:#fff;border-radius:50%;width:2.2rem;height:2.2rem;display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 2px 8px rgba(67,233,123,0.18);animation:popIn 0.5s;\">\u2714</span>`;
      if (isUserChoice && !isCorrectOption) badge = `<span style=\"position:absolute;top:1rem;right:1.5rem;background:rgba(255,88,88,0.95);color:#fff;border-radius:50%;width:2.2rem;height:2.2rem;display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 2px 8px rgba(255,88,88,0.18);animation:shake 0.5s;\">\u2716</span>`;
      const mathFont = needsMathFont(option) ? ' math-font' : '';
      return `<div class=\"mcq-option${mathFont}\" style=\"${cardStyle.join(';')}\">${applyFontDelimiters(option)}${badge}</div>`;
    }).join('')}</div>`;
    // Add explanation box if present, simple text, wider container
    if (q.explanation && q.explanation.trim()) {
      comp.innerHTML += `<div class=\"explanation-box\" style=\"margin-top:2.5rem;background:rgba(255,255,255,0.7);border-radius:1.2rem;box-shadow:0 2px 8px rgba(32,178,170,0.07);font-size:1.15rem;line-height:1.7;padding:1.5rem 2rem;max-width:1100px;width:96%;margin-left:auto;margin-right:auto;\">Explanation:<br>${q.explanation}</div>`;
    }
    renderKatexInline(comp);
  }
  c.append(comp);
}

function confirmExitQuiz() {
  if (quizState && quizState.isExam) {
    autoSubmitExam();
    showPage('home');
    reloadHomeIfActive();
    loadModulesHome();
    return;
  }
  showPage('home');
  reloadHomeIfActive();
  loadModulesHome();
}

function restartModule(mid) {
  getModuleById(mid).then(m => {
    const isExam = m.type === 'exam';
    const message = isExam 
      ? 'Are you sure you want to reset this exam? This will allow you to take the exam again if it\'s within the allowed time window.'
      : 'Are you sure you want to restart? Your previous progress will be reset.';
    
    openModal('Restart Module?', message, [
      { text: 'Cancel', class: 'btn btn-secondary', close: true },
      { 
        text: 'Restart', 
        class: 'btn',
        onClick: () => {
          // Delete user state for this module from IndexedDB
          const tx = db.transaction(STORE_U, 'readwrite');
          const store = tx.objectStore(STORE_U);
          store.delete(mid).onsuccess = () => {
            // For exam modules, also reset the examCompleted status
            if (isExam) {
              const moduleTx = db.transaction(STORE_M, 'readwrite');
              const moduleStore = moduleTx.objectStore(STORE_M);
              m.examCompleted = false;
              m.hidden = false; // Make sure it's not hidden
              moduleStore.put(m);
            }
            
            quizState = { moduleId: mid, done: [] };
            reloadHomeIfActive();
            if (document.getElementById('modules').classList.contains('active')) {
              loadModulesManage();
            }
            toast(isExam ? 'Exam reset successfully' : 'Module restarted successfully', 'success');
          };
        },
        close: true
      }
    ]);
  });
}

// Fetch question
function getQuestionById(qid) {
  return new Promise(res => {
    const tx = db.transaction(STORE_Q, 'readonly'), store = tx.objectStore(STORE_Q);
    store.get(qid).onsuccess = e => res(e.target.result);
  });
}

// -------------------- Questions List & CRUD --------------------
function loadQuestionsList() {
  return new Promise((resolve) => {
    const list = document.getElementById('question-list');
    const searchResultsCount = document.getElementById('search-results-count');
    list.innerHTML = '<div class="spinner"></div>';
    
    // Get both search terms
    const tagSearch = document.getElementById('tag-search').value.trim().toLowerCase();
    const contentSearch = document.getElementById('content-search').value.trim().toLowerCase();
    const isSearching = tagSearch || contentSearch;
    
    // Show loading state
    const questions = [];
    const tx = db.transaction(STORE_Q, 'readonly');
    const store = tx.objectStore(STORE_Q);
    
    // Update total questions count in the UI
    updateQuestionsCount();
    
    const processResults = () => {
      // Remove loading spinner
      if (list.children.length === 1 && list.children[0].classList.contains('spinner')) {
        list.innerHTML = '';
      }
      
      // Filter questions based on search terms
      const filtered = questions.filter(q => {
        // Filter by tags if tag search is active
        const tagMatch = !tagSearch || 
          (q.tags && q.tags.some(tag => {
            // Split search by spaces to handle multiple tags
            const searchTerms = tagSearch.split(/\s+/).filter(t => t.trim() !== '');
            return searchTerms.every(searchTerm => 
              q.tags.some(tag => fuzzyMatch(searchTerm, tag))
            );
          }));
        
        // Filter by content if content search is active
        const contentMatch = !contentSearch || 
          (q.text && q.text.toLowerCase().includes(contentSearch)) ||
          (q.explanation && q.explanation.toLowerCase().includes(contentSearch)) ||
          (q.options && q.options.some(opt => opt.text && opt.text.toLowerCase().includes(contentSearch)));
        
        return tagMatch && contentMatch;
      });

      // Update search results count
      if (isSearching && searchResultsCount) {
        const totalCount = questions.length;
        const filteredCount = filtered.length;
        searchResultsCount.textContent = `Showing ${filteredCount} of ${totalCount} questions`;
        searchResultsCount.style.display = 'block';
      } else if (searchResultsCount) {
        searchResultsCount.style.display = 'none';
      }

      // Display results or empty state
      if (filtered.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <img src="icons/Search.svg" alt="No results" class="empty-state-icon">
            <h3>No questions found</h3>
            <p>We couldn't find any questions matching your search criteria.</p>
            <div class="empty-state-actions">
              <button class="btn btn-outline" onclick="document.getElementById('tag-search').value=''; document.getElementById('content-search').value=''; loadQuestionsList();">
                Clear search filters
              </button>
            </div>
          </div>`;
        resolve();
      } else {
        list.innerHTML = '';
        filtered.forEach(q => list.append(makeQuestionCard(q)));
        
        // If we have a last edited question, scroll to it and highlight it
        if (lastEditedQuestionId) {
          setTimeout(() => {
            const questionCard = document.querySelector(`.question-card[data-id="${lastEditedQuestionId}"]`);
            if (questionCard) {
              // Scroll to the question
              questionCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Add highlight class
              questionCard.classList.add('highlighted');
              
              // Remove highlight after animation
              setTimeout(() => {
                questionCard.classList.remove('highlighted');
              }, 2000);
            }
            // Reset the last edited question ID
            lastEditedQuestionId = null;
          }, 100);
        }
        
        resolve();
      }
    };
    
    // Start the cursor iteration
    const request = store.openCursor();
    request.onsuccess = function(e) {
      const cursor = e.target.result;
      if (cursor) {
        questions.push(cursor.value);
        cursor.continue();
      } else {
        // No more results, process what we have
        processResults();
      }
    };
    
    request.onerror = function() {
      console.error('Error reading questions');
      resolve();
    };
  });
}

// Fuzzy match function for tags
function fuzzyMatch(searchTerm, tag) {
  if (!searchTerm || !tag) return false;
  
  // Convert to lowercase for case-insensitive comparison
  searchTerm = searchTerm.toLowerCase();
  tag = tag.toLowerCase();
  
  // Exact match
  if (tag === searchTerm) return true;
  
  // Contains match
  if (tag.includes(searchTerm) || searchTerm.includes(tag)) return true;
  
  // Common typos and variations
  const commonTypos = {
    'algebra': ['algebr', 'algeba', 'algebar', 'algebrra'],
    'geometry': ['geometri', 'geomtry', 'geometery'],
    'calculus': ['calclus', 'calc', 'calculas'],
    'trigonometry': ['trig', 'trignometry', 'trignometri'],
    'probability': ['prob', 'probabilty', 'probablity'],
    'statistics': ['stats', 'statstics', 'statistcs']
  };
  
  // Check if search term is a common typo
  for (const [correct, typos] of Object.entries(commonTypos)) {
    if (typos.includes(searchTerm) && tag === correct) return true;
    if (typos.some(typo => tag === typo && searchTerm === correct)) return true;
  }
  
  // Levenshtein distance for fuzzy matching (max 2 character differences)
  function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i-1) === a.charAt(j-1)) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1, // substitution
            matrix[i][j-1] + 1,   // insertion
            matrix[i-1][j] + 1    // deletion
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }
  
  // Allow up to 2 character differences for short tags, 3 for longer ones
  const maxDistance = tag.length < 5 ? 1 : tag.length < 8 ? 2 : 3;
  return levenshteinDistance(searchTerm, tag) <= maxDistance;
}

// Add event listeners for both search inputs
document.getElementById('tag-search').addEventListener('input', loadQuestionsList);
document.getElementById('content-search').addEventListener('input', loadQuestionsList);

// Export currently displayed questions
document.getElementById('export-questions').addEventListener('click', () => {
  // Get all currently displayed question cards
  const questionCards = document.querySelectorAll('#question-list .question-card');
  if (questionCards.length === 0) {
    toast('No questions to export', 'info');
    return;
  }

  // Extract question IDs from the displayed cards
  const questionIds = Array.from(questionCards).map(card => card.getAttribute('data-id'));
  
  // Start a read-only transaction
  const tx = db.transaction(STORE_Q, 'readonly');
  const store = tx.objectStore(STORE_Q);
  const questions = [];
  let count = 0;

  // Fetch each question by ID
  questionIds.forEach(id => {
    store.get(Number(id)).onsuccess = (e) => {
      if (e.target.result) {
        questions.push(e.target.result);
      }
      count++;
      
      // When all questions are fetched
      if (count === questionIds.length) {
        if (questions.length === 0) {
          toast('No questions to export', 'info');
          return;
        }
        
        // Create a download link
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(questions, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', `questions_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        toast(`Exported ${questions.length} question${questions.length !== 1 ? 's' : ''}`, 'success');
      }
    };
  });
});

document.getElementById('add-question').addEventListener('click', ()=> openQuestionEditor());
document.getElementById('import-questions').addEventListener('click', () => {
  openModal('Import Questions', `
    <div style="margin-bottom: 1rem;">
      <input type="file" id="import-files" accept=".json" multiple style="display: none;">
      <label for="import-files" class="btn" style="display: block; text-align: center; cursor: pointer; padding: 10px; border: 2px dashed #ccc; border-radius: 4px;">
        <div>Click to select file(s)</div>
        <div style="font-size: 0.8em; color: #666;">Or drag and drop JSON files here</div>
      </label>
      <div id="file-list" style="margin-top: 1rem;"></div>
    </div>
  `, [{
    text: 'Import', 
    class: 'btn', 
    onClick: async () => {
      const fileInput = document.getElementById('import-files');
      const files = Array.from(fileInput.files);
      
      if (files.length === 0) {
        toast('Please select at least one file', 'error');
        return;
      }

      const processFile = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => {
            try {
              let data = JSON.parse(e.target.result);
              // Ensure data is an array
              if (!Array.isArray(data)) {
                data = [data];
              }
              resolve(data);
            } catch (err) {
              console.error(`Error parsing file ${file.name}:`, err);
              reject(new Error(`Invalid JSON in file: ${file.name}`));
            }
          };
          reader.onerror = () => reject(new Error(`Error reading file: ${file.name}`));
          reader.readAsText(file);
        });
      };

      try {
        const results = await Promise.all(files.map(processFile));
        const allQuestions = results.flat();
        
        if (allQuestions.length === 0) {
          throw new Error('No valid questions found in the selected files');
        }

        const tx = db.transaction(STORE_Q, 'readwrite');
        const store = tx.objectStore(STORE_Q);
        
        // Store each question
        const promises = allQuestions.map(q => store.put(q));
        
        tx.oncomplete = () => {
          const count = allQuestions.length;
          toast(`Successfully imported ${count} question${count !== 1 ? 's' : ''}`, 'success');
          loadQuestionsList();
          closeModal();
        };

        tx.onerror = (event) => {
          console.error('Transaction error:', event.target.error);
          toast('Error importing questions', 'error');
        };
      } catch (error) {
        console.error('Import error:', error);
        toast(error.message || 'Error importing questions', 'error');
      }
    }
  }]);

  // Handle file selection display and drag & drop
  const fileInput = document.getElementById('import-files');
  const fileList = document.getElementById('file-list');
  const dropZone = document.getElementById('drop-zone');
  let files = [];

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Update file list display
  const updateFileList = () => {
    fileList.innerHTML = '';
    if (files.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'file-upload-hint';
      emptyMsg.textContent = 'No files selected';
      fileList.appendChild(emptyMsg);
      return;
    }

    files.forEach((file, index) => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <span class="file-icon">📄</span>
        <div class="file-info">
          ${file.name}
          <span class="file-size">${formatFileSize(file.size)}</span>
        </div>
        <span class="file-remove" data-index="${index}">&times;</span>
      `;
      fileList.appendChild(fileItem);
    });

    // Add remove file handler
    document.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index, 10);
        files = files.filter((_, i) => i !== index);
        updateFileList();
      });
    });
  };

  // Handle file input change
  const handleFileChange = () => {
    files = Array.from(fileInput.files);
    updateFileList();
  };

  // Initialize empty file list
  updateFileList();

  // Event listeners
  fileInput.addEventListener('change', handleFileChange);

  // Drag and drop handlers
  const preventDefaults = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const highlight = () => {
    dropZone.classList.add('drag-over');
  };

  const unhighlight = () => {
    dropZone.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    const dt = e.dataTransfer;
    const newFiles = Array.from(dt.files);
    
    // Filter for JSON files only
    const jsonFiles = newFiles.filter(file => 
      file.type === 'application/json' || 
      file.name.endsWith('.json')
    );

    if (jsonFiles.length !== newFiles.length) {
      toast('Only JSON files are supported', 'warning');
    }

    files = [...files, ...jsonFiles];
    updateFileList();
    unhighlight();
  };

  // Add drag and drop event listeners
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults);
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight);
  });

  dropZone.addEventListener('drop', handleDrop);
});

function makeQuestionCard(q) {
  const card = document.createElement('div'); 
  card.className = 'card question-card';
  card.setAttribute('data-id', q.id);
  
  const hdr = document.createElement('div'); 
  hdr.className = 'card-header';
  
  const headerContent = document.createElement('div');
  headerContent.className = 'card-header-content';
  
  // Create summary (without images) and full text views
  const summary = document.createElement('div');
  summary.className = 'summary';
  const summaryText = q.text.replace(/<img[^>]*>/g, ''); // Remove images from summary
  summary.innerHTML = summaryText;
  renderKatexInline(summary);
  
  const fullText = document.createElement('div');
  fullText.className = 'full-text';
  fullText.innerHTML = q.text;
  renderKatexInline(fullText);
  
  // Add tags
  const tags = document.createElement('div');
  tags.className = 'tags';
  q.tags.forEach(tag => {
    const tagEl = document.createElement('span');
    tagEl.className = 'tag';
    tagEl.textContent = tag;
    tags.appendChild(tagEl);
  });
  
  headerContent.append(summary, fullText, tags);
  
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  
  // Expand/Collapse button
  const expandBtn = document.createElement('button');
  expandBtn.className = 'icon-btn';
  expandBtn.innerHTML = '<img src="icons/Chevron Down.svg" alt="Expand">';
  expandBtn.addEventListener('click', () => {
    card.classList.toggle('expanded');
    expandBtn.querySelector('img').style.transform = card.classList.contains('expanded') ? 'rotate(180deg)' : '';
  });
  
  // Answer button
  const ansBtn = document.createElement('button');
  ansBtn.className = 'icon-btn';
  ansBtn.innerHTML = '<img src="icons/Eye.svg" alt="View Answer">';
  ansBtn.addEventListener('click', () => {
    let html = '';
    if (q.type === 'typed') {
      html = `<div>${q.answer}</div>`;
    } else {
      html = '<ul class="quiz-options">';
      q.options.forEach((opt, i) => {
        const cls = i === q.correctIndex ? 'correct' : '';
        html += `<li><button class="${cls}">${String.fromCharCode(65 + i)}. ${opt}</button></li>`;
      });
      html += '</ul>';
    }
    openModal('Answer', html, [{text: 'Close', close: true}]);
  });
  
  // Export button
  const expBtn = document.createElement('button');
  expBtn.className = 'icon-btn';
  expBtn.innerHTML = '<img src="icons/Export.svg" alt="Export">';
  expBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(q)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `question_${q.id}.json`;
    a.click();
    toast('Exported question');
  });
  
  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'icon-btn';
  editBtn.innerHTML = '<img src="icons/Edit.svg" alt="Edit">';
  editBtn.addEventListener('click', () => openQuestionEditor(q));
  
  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'icon-btn';
  delBtn.innerHTML = '<img src="icons/Delete.svg" alt="Delete">';
  delBtn.addEventListener('click', () => {
    openModal('Confirm Delete', 'Delete this question?', [
      {
        text: 'Delete',
        class: 'btn',
        onClick: () => {
          const tx = db.transaction(STORE_Q, 'readwrite');
          const store = tx.objectStore(STORE_Q);
          store.delete(q.id).onsuccess = () => {
            toast('Deleted');
            loadQuestionsList();
          };
        },
        close: true
      },
      {text: 'Cancel', close: true}
    ]);
  });
  
  actions.append(expandBtn, ansBtn, expBtn, editBtn, delBtn);
  hdr.append(headerContent, actions);
  
  const body = document.createElement('div');
  body.className = 'card-body';
  if (q.type === 'typed') {
    const answerNeedsMathFont = needsMathFont(q.answer);
    body.innerHTML = `<div class="${answerNeedsMathFont ? 'math-font' : ''}"><strong>Answer:</strong><br>${applyFontDelimiters(q.answer)}</div>`;
    renderKatexInline(body);
  } else {
    // MCQ: render options as buttons with correct/incorrect classes
    let html = '<div><strong>Answer:</strong><br><ul class="quiz-options">';
    q.options.forEach((opt, i) => {
      const cls = i === q.correctIndex ? 'correct' : '';
      const mathFont = needsMathFont(opt) ? 'math-font' : '';
      html += `<li><button class="${cls} ${mathFont}">${String.fromCharCode(65 + i)}. <span class="option-text${mathFont ? ' math-font' : ''}">${applyFontDelimiters(opt)}</span></button></li>`;
    });
    html += '</ul></div>';
    body.innerHTML = html;
    renderKatexInline(body);
  }
  // Add explanation box if present
  if (q.explanation && q.explanation.trim()) {
    const expl = document.createElement('div');
    expl.className = 'explanation-box';
    expl.innerHTML = `<strong>Explanation:</strong><br>${q.explanation}`;
    renderKatexInline(expl);
    body.appendChild(expl);
  }
  card.append(hdr, body);
  return card;
}

// Question Editor
let editQuestionId = null;
// Track the last edited question for scroll-to functionality
let lastEditedQuestionId = null;
function openQuestionEditor(q=null) {
  editQuestionId = q ? q.id : null;
  document.getElementById('question-edit-title').textContent = q ? 'Edit Question' : 'Add Question';
  showPage('question-edit');
  if (q) {
    document.getElementById('q-editor').innerHTML = q.text;
    document.getElementById('answer-type').value = q.type;
    if (q.type==='typed') {
      document.getElementById('typed-answer-group').style.display='block';
      document.getElementById('mcq-group').style.display='none';
      document.getElementById('a-editor').innerHTML = q.answer;
      // Set math-font class if answer has math-font
      if (/class=["']math-font["']/.test(q.answer)) {
        document.getElementById('a-editor').classList.add('math-font');
      } else {
        document.getElementById('a-editor').classList.remove('math-font');
      }
    } else {
      document.getElementById('typed-answer-group').style.display='none';
      document.getElementById('mcq-group').style.display='block';
      rebuildOptions(q.options, q.correctIndex);
    }
    document.getElementById('question-tags').value = q.tags.join(',');
    // Load explanation if present
    document.getElementById('e-editor').innerHTML = q.explanation || '';
    updateBreadcrumb('questions', { action: 'edit', tags: q.tags });
  } else {
    document.getElementById('q-editor').innerHTML = '';
    document.getElementById('typed-answer-group').style.display='block';
    document.getElementById('mcq-group').style.display='none';
    document.getElementById('a-editor').innerHTML = '';
    document.getElementById('options-container').innerHTML = '';
    document.getElementById('question-tags').value = '';
    document.getElementById('e-editor').innerHTML = '';
    updateBreadcrumb('questions', { action: 'add' });
  }
  setTimeout(() => {
    renderKatexInEditor(document.getElementById('q-editor'));
    renderKatexInEditor(document.getElementById('a-editor'));
    renderKatexInEditor(document.getElementById('e-editor'));
  }, 100);
}
document.getElementById('cancel-question-edit').addEventListener('click', ()=>showPage('questions'));
document.getElementById('answer-type').addEventListener('change', e=>{
  if (e.target.value==='typed') {
    document.getElementById('typed-answer-group').style.display='block';
    document.getElementById('mcq-group').style.display='none';
  } else {
    document.getElementById('typed-answer-group').style.display='none';
    document.getElementById('mcq-group').style.display='block';
  }
});

document.getElementById('add-option').addEventListener('click', ()=> {
  rebuildOptions([...getCurrentOptions(), ''], 0);
});

function getCurrentOptions() {
  return Array.from(document.querySelectorAll('.option-input')).map(el=>el.innerText);
}

// --- ENHANCED RICH TEXT EDITOR LOGIC ---
function toggleMathFontOnSelection(editor) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  const range = sel.getRangeAt(0);
  // If the whole editor is selected, apply/remove .math-font to the editor
  if (range.startContainer === editor && range.endContainer === editor && range.startOffset === 0 && range.endOffset === editor.childNodes.length) {
    editor.classList.toggle('math-font');
    return true;
  }
  if (range.toString() === editor.innerText) {
    editor.classList.toggle('math-font');
    return true;
  }
  // Otherwise, apply/remove .math-font to the selection
  let alreadyMath = false;
  if (sel.anchorNode && sel.anchorNode.parentElement && sel.anchorNode.parentElement.classList.contains('math-font')) {
    alreadyMath = true;
  }
  if (alreadyMath) {
    const span = sel.anchorNode.parentElement;
    if (span && span.classList.contains('math-font')) {
      const text = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(text, span);
      text.parentNode.style.fontFamily = "'Roboto Slab', serif";
      range.selectNodeContents(text);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  } else {
    const span = document.createElement('span');
    span.className = 'math-font';
    range.surroundContents(span);
    range.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  return true;
}

function renderKatexInEditor(editor) {
  if (!window.katex) return;
  // Find all katex-equation spans
  editor.querySelectorAll('span.katex-equation[data-latex]').forEach(span => {
    const latex = span.getAttribute('data-latex');
    let renderSpan = span.querySelector('.katex-render');
    if (!renderSpan) {
      renderSpan = document.createElement('span');
      renderSpan.className = 'katex-render';
      span.innerHTML = '';
      span.appendChild(renderSpan);
    }
    try {
      renderSpan.innerHTML = '';
      katex.render(latex, renderSpan, { throwOnError: false, displayMode: false, plugins: [window.katexMhchem] });
    } catch (e) {
      renderSpan.innerHTML = '<span style="color:red">Invalid LaTeX</span>';
    }
    // Add toolbar if not present
    let toolbar = span.querySelector('.katex-toolbar');
    if (!toolbar) {
      toolbar = document.createElement('span');
      toolbar.className = 'katex-toolbar';
      toolbar.innerHTML = `
        <button type="button" class="katex-edit" title="Edit"><img src="icons/Edit.svg" alt="Edit" style="width:1.1em;height:1.1em;"></button>
        <button type="button" class="katex-delete" title="Delete"><img src="icons/Delete.svg" alt="Delete" style="width:1.1em;height:1.1em;"></button>
      `;
      span.appendChild(toolbar);
    }
    // Attach events
    toolbar.querySelector('.katex-edit').onclick = (e) => {
      e.stopPropagation();
      const initialLatex = span.getAttribute('data-latex') || '';
      const initialClasses = getFormattingClassesFromSpan(span);
      const initialFontSize = getFontSizeFromSpan(span);
      openKatexModal({
        initialLatex,
        initialClasses,
        onInsert: ({ latex, classes, fontSize }) => {
          span.setAttribute('data-latex', latex);
          span.className = 'katex-equation ' + (classes || []).join(' ');
          if (fontSize && fontSize !== 1) span.style.fontSize = fontSize + 'em';
          else span.style.fontSize = '';
          renderKatexInEditor(editor);
        },
        onCancel: () => {}
      });
    };
    toolbar.querySelector('.katex-delete').onclick = (e) => {
      e.stopPropagation();
      span.remove();
    };
  });
}

function insertKatexAtSelectionWithFormatting(editor, latex, classes, fontSize) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  // Explicitly delete any selected content (prevents double insertion)
  if (!range.collapsed) {
    range.deleteContents();
  }
  const span = document.createElement('span');
  span.className = 'katex-equation ' + (classes || []).join(' ');
  span.setAttribute('data-latex', latex);
  span.contentEditable = 'false';
  if (fontSize && fontSize !== 1) span.style.fontSize = fontSize + 'em';
  // Add .katex-render and .katex-toolbar
  const renderSpan = document.createElement('span');
  renderSpan.className = 'katex-render';
  span.appendChild(renderSpan);
  const toolbar = document.createElement('span');
  toolbar.className = 'katex-toolbar';
  toolbar.innerHTML = `
    <button type="button" class="katex-edit" title="Edit"><img src="icons/Edit.svg" alt="Edit" style="width:1.1em;height:1.1em;"></button>
    <button type="button" class="katex-delete" title="Delete"><img src="icons/Delete.svg" alt="Delete" style="width:1.1em;height:1.1em;"></button>
  `;
  span.appendChild(toolbar);
  // Render KaTeX
  try {
    renderSpan.innerHTML = '';
    katex.render(latex, renderSpan, { throwOnError: false, displayMode: false, plugins: [window.katexMhchem] });
  } catch (e) {
    renderSpan.innerHTML = '<span style="color:red">Invalid LaTeX</span>';
  }
  // Insert
  range.insertNode(span);
  // Collapse selection after the inserted node
  range.setStartAfter(span);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  editor.focus();
  // Attach toolbar events
  toolbar.querySelector('.katex-edit').onclick = (e) => {
    e.stopPropagation();
    const initialLatex = span.getAttribute('data-latex') || '';
    const initialClasses = getFormattingClassesFromSpan(span);
    const initialFontSize = getFontSizeFromSpan(span);
    openKatexModal({
      initialLatex,
      initialClasses,
      onInsert: ({ latex, classes, fontSize }) => {
        span.setAttribute('data-latex', latex);
        span.className = 'katex-equation ' + (classes || []).join(' ');
        if (fontSize && fontSize !== 1) span.style.fontSize = fontSize + 'em';
        else span.style.fontSize = '';
        renderKatexInEditor(editor);
      },
      onCancel: () => {}
    });
  };
  toolbar.querySelector('.katex-delete').onclick = (e) => {
    e.stopPropagation();
    span.remove();
  };
}

// Function to create a table with the specified rows and columns
function createTable(rows, cols, style = '') {
  let table = document.createElement('table');
  if (style) table.className = style;
  
  // Add table controls
  const controls = document.createElement('div');
  controls.className = 'table-controls';
  controls.innerHTML = `
    <button class="table-control-btn" data-action="add-row" title="Add Row">+R</button>
    <button class="table-control-btn" data-action="add-col" title="Add Column">+C</button>
    <button class="table-control-btn" data-action="delete-row" title="Delete Row">-R</button>
    <button class="table-control-btn" data-action="delete-col" title="Delete Column">-C</button>
  `;
  table.appendChild(controls);
  
  // Create header row
  const thead = document.createElement('thead');
  let headerRow = document.createElement('tr');
  for (let i = 0; i < cols; i++) {
    const th = document.createElement('th');
    th.contentEditable = 'true';
    th.innerHTML = '&nbsp;'; // Add non-breaking space for better editing
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create table body
  const tbody = document.createElement('tbody');
  for (let i = 1; i < rows; i++) {
    const row = document.createElement('tr');
    for (let j = 0; j < cols; j++) {
      const cell = document.createElement('td');
      cell.contentEditable = 'true';
      cell.innerHTML = '&nbsp;'; // Add non-breaking space for better editing
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  
  // Add event listeners for table controls
  addTableControlListeners(table);
  
  return table;
}

// Add event listeners to table controls
function addTableControlListeners(table) {
  const controls = table.querySelector('.table-controls');
  if (!controls) return;
  
  controls.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const tbody = table.querySelector('tbody') || table;
    const rows = tbody.rows;
    const firstRow = rows[0];
    if (!firstRow) return;
    
    const colCount = firstRow.cells.length;
    
    switch (action) {
      case 'add-row':
        const newRow = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
          const cell = document.createElement('td');
          cell.contentEditable = 'true';
          cell.innerHTML = '&nbsp;';
          newRow.appendChild(cell);
        }
        tbody.appendChild(newRow);
        break;
        
      case 'add-col':
        Array.from(rows).forEach(row => {
          const cell = document.createElement(row.cells[0].tagName); // th or td
          cell.contentEditable = 'true';
          cell.innerHTML = '&nbsp;';
          row.appendChild(cell);
        });
        break;
        
      case 'delete-row':
        if (rows.length > 1) {
          const lastRow = rows[rows.length - 1];
          lastRow.parentNode.removeChild(lastRow);
        }
        break;
        
      case 'delete-col':
        if (colCount > 1) {
          Array.from(rows).forEach(row => {
            if (row.cells.length > 1) {
              row.deleteCell(-1);
            }
          });
        }
        break;
    }
  });
}

// Initialize table functionality for the editor
function initTableFunctionality(editor) {
  console.log('Initializing table functionality for editor:', editor.id);
  
  const toolbar = editor.previousElementSibling;
  if (!toolbar || !toolbar.classList.contains('rich-toolbar')) {
    console.warn('Could not find rich toolbar for editor:', editor.id);
    return;
  }
  
  const tableBtn = toolbar.querySelector('.insert-table-btn');
  if (!tableBtn) {
    console.warn('Could not find table button in toolbar for editor:', editor.id);
    return;
  }
  
  // Add click handler for the table button
  tableBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Show the table insertion modal
    showTableInsertModal(editor);
  });
  
  // Make sure the button is visible
  tableBtn.style.display = 'inline-flex';
  tableBtn.style.visibility = 'visible';
  tableBtn.style.opacity = '1';
  
  console.log('Table button initialized for editor:', editor.id);
  
  // Function to handle table control events
  function addTableControlListeners(table) {
    const controls = table.querySelector('.table-controls');
    if (!controls) return;
    
    controls.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const action = btn.getAttribute('data-action');
        const cell = controls.closest('td, th');
        const row = cell ? cell.closest('tr') : null;
        
        if (!row) return;
        
        const rows = Array.from(table.querySelectorAll('tr'));
        const rowIndex = rows.indexOf(row);
        const cellIndex = Array.from(row.cells).indexOf(cell);
        
        switch (action) {
          case 'add-row':
            // Add a new row after the current row
            const newRow = row.cloneNode(true);
            // Clear the content of the new row
            newRow.querySelectorAll('td[contenteditable="true"]').forEach(td => {
              td.innerHTML = '&nbsp;';
            });
            row.parentNode.insertBefore(newRow, row.nextSibling);
            break;
            
          case 'add-col':
            // Add a new column after the current cell
            rows.forEach(r => {
              const newCell = document.createElement(cell.tagName);
              newCell.setAttribute('contenteditable', 'true');
              newCell.innerHTML = '&nbsp;';
              if (r.cells[cellIndex + 1]) {
                r.insertBefore(newCell, r.cells[cellIndex + 1]);
              } else {
                r.appendChild(newCell);
              }
            });
            break;
            
          case 'delete-row':
            // Don't delete the last row
            if (rows.length > 1) {
              row.parentNode.removeChild(row);
            }
            break;
            
          case 'delete-col':
            // Don't delete the last column
            if (row.cells.length > 1) {
              rows.forEach(r => {
                if (r.cells[cellIndex]) {
                  r.removeChild(r.cells[cellIndex]);
                }
              });
            }
            break;
        }
      });
    });
  }
  
  // Handle table controls for existing tables
  editor.addEventListener('click', (e) => {
    const table = e.target.closest('table');
    if (table && !table.querySelector('.table-controls')) {
      // Add controls to tables that don't have them
      const controls = document.createElement('div');
      controls.className = 'table-controls';
      controls.innerHTML = `
        <button class="table-control-btn" data-action="add-row" title="Add Row">+R</button>
        <button class="table-control-btn" data-action="add-col" title="Add Column">+C</button>
        <button class="table-control-btn" data-action="delete-row" title="Delete Row">-R</button>
        <button class="table-control-btn" data-action="delete-col" title="Delete Column">-C</button>
      `;
      table.insertBefore(controls, table.firstChild);
      addTableControlListeners(table);
    }
  });
}

function initRichTextEditor(toolbar, editor) {
  if (!toolbar || !editor) return;
  
  // Math symbol mapping for Alt+Number shortcuts
  const altMathMap = {
    '0178': '²',
    '0179': '³',
    '8730': '√',
    '960': 'π',
    '8734': '∞',
    '8804': '≤',
    '8805': '≥',
    '177': '±',
    '215': '×',
    '247': '÷',
    '8706': '∂',
    '8721': '∑',
    '8747': '∫',
    '8736': '∠',
    '8733': '∝',
    '8704': '∀',
    '8707': '∃',
    '8712': '∈',
    '8713': '∉',
    '8715': '∋',
    '8745': '∩',
    '8746': '∪',
    '8709': '∅',
    '8800': '≠',
    '8776': '≈',
    '8739': '|',
    '8594': '→',
    '8592': '←',
    '8658': '⇒',
    '8656': '⇐',
    '8660': '⇔',
    '8727': '∗',
    '8722': '−',
    '8728': '∘',
    '8743': '∧',
    '8744': '∨',
    '8708': '∄',
    '8711': '∇',
    '8729': '∙',
    '8801': '≡',
    '8773': '≅',
    '8777': '≉',
    '8805': '≥',
    '8804': '≤',
    '8806': '≦',
    '8807': '≧',
    '8735': '∟',
    '8738': '∢',
    '8748': '∬',
    '8749': '∭',
    '8750': '∮',
    '8751': '∯',
    '8752': '∰',
    '8753': '∱',
    '8754': '∲',
    '8755': '∳',
    '8756': '∴',
    '8757': '∵',
    '8758': '∶',
    '8759': '∷',
    '8760': '∸',
    '8761': '∹',
    '8762': '∺',
    '8763': '∻',
    '8764': '∼',
    '8765': '∽',
    '8766': '∾',
    '8767': '∿',
    '8770': '≂',
    '8771': '≃',
    '8772': '≄',
    '8775': '≇',
    '8778': '≊',
    '8779': '≋',
    '8780': '≌',
    '8781': '≍',
    '8782': '≎',
    '8783': '≏',
    '8784': '≐',
    '8785': '≑',
    '8786': '≒',
    '8787': '≓',
    '8788': '≔',
    '8789': '≕',
    '8790': '≖',
    '8791': '≗',
    '8792': '≘',
    '8793': '≙',
    '8794': '≚',
    '8795': '≛',
    '8796': '≜',
    '8797': '≝',
    '8798': '≞',
    '8799': '≟',
    '8802': '≢',
    '8803': '≣',
    '8808': '≨',
    '8809': '≩',
    '8810': '≪',
    '8811': '≫',
    '8812': '≬',
    '8813': '≭',
    '8814': '≮',
    '8815': '≯',
    '8816': '≰',
    '8817': '≱',
    '8818': '≲',
    '8819': '≳',
    '8820': '≴',
    '8821': '≵',
    '8822': '≶',
    '8823': '≷',
    '8824': '≸',
    '8825': '≹',
    '8826': '≺',
    '8827': '≻',
    '8828': '≼',
    '8829': '≽',
    '8830': '≾',
    '8831': '≿',
    '8832': '⊀',
    '8833': '⊁',
    '8834': '⊂',
    '8835': '⊃',
    '8836': '⊄',
    '8837': '⊅',
    '8838': '⊆',
    '8839': '⊇',
    '8840': '⊈',
    '8841': '⊉',
    '8842': '⊊',
    '8843': '⊋',
    '8844': '⊌',
    '8845': '⊍',
    '8846': '⊎',
    '8847': '⊏',
    '8848': '⊐',
    '8849': '⊑',
    '8850': '⊒',
    '8851': '⊓',
    '8852': '⊔',
    '8853': '⊕',
    '8854': '⊖',
    '8855': '⊗',
    '8856': '⊘',
    '8857': '⊙',
    '8858': '⊚',
    '8859': '⊛',
    '8860': '⊜',
    '8861': '⊝',
    '8862': '⊞',
    '8863': '⊟',
    '8864': '⊠',
    '8865': '⊡',
    '8866': '⊢',
    '8867': '⊣',
    '8868': '⊤',
    '8869': '⊥',
    '8870': '⊦',
    '8871': '⊧',
    '8872': '⊨',
    '8873': '⊩',
    '8874': '⊪',
    '8875': '⊫',
    '8876': '⊬',
    '8877': '⊭',
    '8878': '⊮',
    '8879': '⊯',
    '8880': '⊰',
    '8881': '⊱',
    '8882': '⊲',
    '8883': '⊳',
    '8884': '⊴',
    '8885': '⊵',
    '8886': '⊶',
    '8887': '⊷',
    '8888': '⊸',
    '8889': '⊹',
    '8890': '⊺',
    '8891': '⊻',
    '8892': '⊼',
    '8893': '⊽',
    '8894': '⊾',
    '8895': '⊿',
    '8896': '⋀',
    '8897': '⋁',
    '8898': '⋂',
    '8899': '⋃',
    '8900': '⋄',
    '8901': '⋅',
    '8902': '⋆',
    '8903': '⋇',
    '8904': '⋈',
    '8905': '⋉',
    '8906': '⋊',
    '8907': '⋋',
    '8908': '⋌',
    '8909': '⋍',
    '8910': '⋎',
    '8911': '⋏',
    '8912': '⋐',
    '8913': '⋑',
    '8914': '⋒',
    '8915': '⋓',
    '8916': '⋔',
    '8917': '⋕',
    '8918': '⋖',
    '8919': '⋗',
    '8920': '⋘',
    '8921': '⋙',
    '8922': '⋚',
    '8923': '⋛',
    '8924': '⋜',
    '8925': '⋝',
    '8926': '⋞',
    '8927': '⋟',
    '8928': '⋠',
    '8929': '⋡',
    '8930': '⋢',
    '8931': '⋣',
    '8932': '⋤',
    '8933': '⋥',
    '8934': '⋦',
    '8935': '⋧',
    '8936': '⋨',
    '8937': '⋩',
    '8938': '⋪',
    '8939': '⋫',
    '8940': '⋬',
    '8941': '⋭',
    '8942': '⋮',
    '8943': '⋯',
    '8944': '⋰',
    '8945': '⋱',
    '8946': '⋲',
    '8947': '⋳',
    '8948': '⋴',
    '8949': '⋵',
    '8950': '⋶',
    '8951': '⋷',
    '8952': '⋸',
    '8953': '⋹',
    '8954': '⋺',
    '8955': '⋻',
    '8956': '⋼',
    '8957': '⋽',
    '8958': '⋾',
    '8959': '⋿',
  };

  let altNumBuffer = '';
  let altActive = false;

  // Create toolbar groups
  const formatGroup = document.createElement('div');
  formatGroup.className = 'rich-toolbar-group';
  formatGroup.innerHTML = `
    <button data-cmd="bold" title="Bold"><img src="icons/Bold.svg" alt="Bold"></button>
    <button data-cmd="italic" title="Italic"><img src="icons/Italics.svg" alt="Italic"></button>
    <button data-cmd="underline" title="Underline"><img src="icons/Underline.svg" alt="Underline"></button>
    <button data-cmd="strikeThrough" title="Strikethrough"><img src="icons/Strikethrough.svg" alt="Strikethrough"></button>
  `;
  
  const listGroup = document.createElement('div');
  listGroup.className = 'rich-toolbar-group';
  listGroup.innerHTML = `
    <button data-cmd="insertUnorderedList" title="Bullet List"><img src="icons/Bullet List.svg" alt="Bullet List"></button>
    <button data-cmd="insertOrderedList" title="Numbered List"><img src="icons/Numbered List.svg" alt="Numbered List"></button>
  `;
  
  const mathGroup = document.createElement('div');
  mathGroup.className = 'rich-toolbar-group';
  mathGroup.innerHTML = `
    <button data-cmd="superscript" title="Superscript"><img src="icons/Superscript.svg" alt="Superscript"></button>
    <button data-cmd="subscript" title="Subscript"><img src="icons/Subscript.svg" alt="Subscript"></button>
  `;
  
  const mathFontGroup = document.createElement('div');
  mathFontGroup.className = 'rich-toolbar-group';
  mathFontGroup.innerHTML = `
    <button data-cmd="mathFont" title="Math Font"><img src="icons/Math Font.svg" alt="Math Font"></button>
  `;
  
  const fontSizeGroup = document.createElement('div');
  fontSizeGroup.className = 'rich-toolbar-group';
  fontSizeGroup.innerHTML = `
    <button data-cmd="increaseFont" title="Increase Font Size"><img src="icons/FontUp.svg" alt="A+" style="width:1.1rem;height:1.1rem;"></button>
    <button data-cmd="decreaseFont" title="Decrease Font Size"><img src="icons/FontDown.svg" alt="A-" style="width:1.1rem;height:1.1rem;"></button>
  `;
  
  const mediaGroup = document.createElement('div');
  mediaGroup.className = 'rich-toolbar-group';
  mediaGroup.innerHTML = `
    <input type="file" id="${editor.id}-file" class="file-input" accept="image/*">
    <label for="${editor.id}-file" class="file-label">
      <img src="icons/Image.svg" alt="Insert Image"> Insert Image
    </label>
  `;
  
  // Clear existing toolbar content
  toolbar.innerHTML = '';
  toolbar.append(formatGroup, listGroup, mathGroup, mathFontGroup, fontSizeGroup, mediaGroup);
  
  // Handle image upload with reset
  const fileInput = toolbar.querySelector('.file-input');
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        editor.focus();
        document.execCommand('insertHTML', false, img.outerHTML);
      };
      reader.readAsDataURL(file);
    }
  });
  
  // Handle formatting commands
  Array.from(toolbar.querySelectorAll('button[data-cmd]')).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const command = btn.dataset.cmd;
      if (command === 'mathFont') {
        // Use custom modal for KaTeX
        const sel = window.getSelection();
        let initialLatex = '';
        let savedRange = null;
        // Save selection range if in editor
        if (sel.rangeCount && editor.contains(sel.anchorNode)) {
          savedRange = sel.getRangeAt(0).cloneRange();
        }
        if (sel.rangeCount && !sel.isCollapsed) {
          const selectedText = sel.toString();
          initialLatex = selectedText;
        }
        openKatexModal({
          initialLatex,
          initialClasses: [],
          onInsert: ({ latex, classes, fontSize }) => {
            // Restore selection before inserting
            editor.focus();
            if (savedRange) {
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(savedRange);
            }
            insertKatexAtSelectionWithFormatting(editor, latex, classes, fontSize);
            renderKatexInEditor(editor);
          },
          onCancel: () => {}
        });
      } else if (command === 'increaseFont' || command === 'decreaseFont') {
        let sel = window.getSelection();
        if (!sel.rangeCount) return;
        let range = sel.getRangeAt(0);
        let span = document.createElement('span');
        let size = 16;
        if (sel.anchorNode && sel.anchorNode.parentElement && sel.anchorNode.parentElement.style.fontSize) {
          size = parseInt(sel.anchorNode.parentElement.style.fontSize) || 16;
        }
        size += (command === 'increaseFont' ? 2 : -2);
        size = Math.max(10, Math.min(48, size));
        span.style.fontSize = size + 'px';
        span.innerHTML = range.toString();
        range.deleteContents();
        range.insertNode(span);
        sel.removeAllRanges();
        let newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
        editor.focus();
        return;
      } else {
        document.execCommand(command, false, null);
      }
      updateToolbarState();
      editor.focus();
    });
  });
  
  // Setup editor focus/blur events
  editor.addEventListener('focus', updateToolbarState);
  editor.addEventListener('blur', updateToolbarState);
  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);
  
  // Handle special key events
  editor.addEventListener('keydown', e => {
    // Handle the '^' character for superscript
    if (e.key === '^') {
      e.preventDefault();
      document.execCommand('superscript', false, null);
    }

    // Alt+Number buffer for math symbols
    if (e.altKey && !isNaN(Number(e.key))) {
      altActive = true;
      altNumBuffer += e.key;
      e.preventDefault();
      return;
    }
    // On Alt release, insert symbol if buffer matches
    if (!e.altKey && altActive && altNumBuffer) {
      const symbol = altMathMap[altNumBuffer];
      if (symbol) {
        document.execCommand('insertText', false, symbol);
      }
      altNumBuffer = '';
      altActive = false;
    }
    
    // Microsoft Word style shortcuts for mathematical symbols
    const mathShortcuts = {
      // Arrows
      '->': '→',
      '=>': '⇒',
      '<-': '←',
      '<=': '⇐',
      '<=>': '⇔',
      
      // Greek letters (preceded by \)
      '\\alpha': 'α',
      '\\beta': 'β',
      '\\gamma': 'γ',
      '\\delta': 'δ',
      '\\epsilon': 'ε',
      '\\zeta': 'ζ',
      '\\eta': 'η',
      '\\theta': 'θ',
      '\\iota': 'ι',
      '\\kappa': 'κ',
      '\\lambda': 'λ',
      '\\mu': 'μ',
      '\\nu': 'ν',
      '\\xi': 'ξ',
      '\\omicron': 'ο',
      '\\pi': 'π',
      '\\rho': 'ρ',
      '\\sigma': 'σ',
      '\\tau': 'τ',
      '\\upsilon': 'υ',
      '\\phi': 'φ',
      '\\chi': 'χ',
      '\\psi': 'ψ',
      '\\omega': 'ω',
      
      // Math symbols
      '\\infty': '∞',
      '\\approx': '≈',
      '\\neq': '≠',
      '\\leq': '≤',
      '\\geq': '≥',
      '\\partial': '∂',
      '\\nabla': '∇',
      '\\exists': '∃',
      '\\forall': '∀',
      '\\in': '∈',
      '\\notin': '∉',
      '\\ni': '∋',
      '\\cap': '∩',
      '\\cup': '∪',
      '\\subset': '⊂',
      '\\supset': '⊃',
      '\\emptyset': '∅',
      '\\pm': '±',
      '\\times': '×',
      '\\div': '÷',
      '\\sum': '∑',
      '\\prod': '∏',
      '\\int': '∫',
      '\\sqrt': '√',
      '\\propto': '∝',
    };
    
    // Process shortcuts only on space keypress
    if (e.key === ' ') {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(editor);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        
        const text = preCaretRange.toString();
        let replaced = false;
        
        // Check for math shortcuts
        for (const [shortcut, symbol] of Object.entries(mathShortcuts)) {
          if (text.endsWith(shortcut)) {
            e.preventDefault();
            
            // Delete the shortcut
            const deleteRange = document.createRange();
            deleteRange.setStart(range.endContainer, range.endOffset - shortcut.length);
            deleteRange.setEnd(range.endContainer, range.endOffset);
            selection.removeAllRanges();
            selection.addRange(deleteRange);
            document.execCommand('delete', false);
            
            // Insert the symbol
            document.execCommand('insertText', false, symbol);
            
            // Enable math font if not already enabled
            if (!editor.classList.contains('math-font')) {
              editor.classList.add('math-font');
              const mathFontBtn = toolbar.querySelector('[data-cmd="mathFont"]');
              if (mathFontBtn) mathFontBtn.classList.add('active');
            }
            
            replaced = true;
            break;
          }
        }
        
        // If we replaced something, don't insert the space
        if (replaced) {
          e.preventDefault();
        }
      }
    }
  });
  
  // Auto-detect math symbols and enable math font
  editor.addEventListener('input', () => {
    autoRenderKatexInEditor(editor);
    renderKatexInEditor(editor);
    const mathSymbols = ['∫', '∑', '∏', '√', '∞', '≈', '≠', '≤', '≥', '∂', '∇', '∃', '∀', '∈', '∉', '∋', 'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'];
    if (mathSymbols.some(symbol => editor.textContent.includes(symbol)) && !editor.classList.contains('math-font')) {
      editor.classList.add('math-font');
      const mathFontBtn = toolbar.querySelector('[data-cmd="mathFont"]');
      if (mathFontBtn) mathFontBtn.classList.add('active');
    }
  });
  
  // Update toolbar button states based on current text formatting
  function updateToolbarState() {
    Array.from(toolbar.querySelectorAll('button[data-cmd]')).forEach(btn => {
      const command = btn.dataset.cmd;
      if (command === 'format') {
        // Don't handle format buttons in the state update
      } else if (command === 'mathFont') {
        // Math font state is tracked by editor class
        btn.classList.toggle('active', editor.classList.contains('math-font'));
      } else {
        try {
          btn.classList.toggle('active', document.queryCommandState(command));
        } catch (e) {
          // Some commands may not be supported in all browsers
        }
      }
    });
  }
  // Initial render
  renderKatexInEditor(editor);
  // Double-click to edit KaTeX
  editor.addEventListener('dblclick', (e) => {
    const target = e.target;
    if (target.classList && target.classList.contains('katex-equation')) {
      const oldLatex = target.getAttribute('data-latex') || '';
      let latex = prompt('Edit LaTeX equation:', oldLatex);
      if (latex !== null && latex.trim() !== '') {
        target.setAttribute('data-latex', latex.trim());
        try {
          katex.render(latex.trim(), target, { throwOnError: false, displayMode: false, plugins: [window.katexMhchem] });
        } catch (e) {
          target.innerHTML = '<span style="color:red">Invalid LaTeX</span>';
        }
      }
    }
  });
}

// Initialize all rich text editors when the page loads
window.addEventListener('DOMContentLoaded', () => {
  const editors = [
    { toolbar: '#q-toolbar', editor: '#q-editor' },
    { toolbar: '#a-toolbar', editor: '#a-editor' },
    { toolbar: '#m-toolbar', editor: '#m-editor' },
    { toolbar: '#e-toolbar', editor: '#e-editor' } // Explanation editor
  ];
  
  editors.forEach(({ toolbar, editor }) => {
    const toolbarEl = document.querySelector(toolbar);
    const editorEl = document.querySelector(editor);
    if (toolbarEl && editorEl) {
      initRichTextEditor(toolbarEl, editorEl);
      initTableFunctionality(editorEl);
      renderKatexInEditor(editorEl);
    }
  });
  updateBreadcrumb('home');
});

// Initialize MCQ option interface
function rebuildOptions(options = [], correctIndex = -1) {
  const container = document.getElementById('options-container');
  container.innerHTML = '';
  
  options.forEach((opt, i) => {
    const optionGroup = document.createElement('div');
    optionGroup.className = 'option-group';
    
    const header = document.createElement('div');
    header.className = 'option-header';
    header.innerHTML = `
      <label>
        <input type="radio" name="correct-option" ${i === correctIndex ? 'checked' : ''}>
        Option ${String.fromCharCode(65 + i)}
      </label>
      <button class="action-btn secondary" onclick="removeOption(${i})">
        <img src="icons/Delete.svg" alt="Remove">
      </button>
    `;
    
    const content = document.createElement('div');
    content.className = 'option-content';
    
    const toolbar = document.createElement('div');
    toolbar.className = 'rich-toolbar option-toolbar';
    toolbar.innerHTML = `
      <button data-cmd="bold"><img src="icons/Bold.svg" alt="Bold"></button>
      <button data-cmd="italic"><img src="icons/Italics.svg" alt="Italic"></button>
      <button data-cmd="superscript"><img src="icons/Superscript.svg" alt="Superscript"></button>
      <button data-cmd="subscript"><img src="icons/Subscript.svg" alt="Subscript"></button>
      <button data-cmd="mathFont"><img src="icons/Math Font.svg" alt="Math Font"> Math Font</button>
    `;
    
    const editor = document.createElement('div');
    editor.className = 'option-input';
    editor.contentEditable = true;
    editor.innerHTML = opt;
    
    content.append(toolbar, editor);
    optionGroup.append(header, content);
    container.append(optionGroup);
    
    // Initialize the rich text editor
    const optionEditor = initRichTextEditor(toolbar, editor);
    initTableFunctionality(editor);
    renderKatexInEditor(editor);
    // Add Insert Equation button logic
    const insertBtn = toolbar.querySelector('.insert-katex-btn');
    if (insertBtn) {
      insertBtn.addEventListener('click', () => {
        let savedRange = null;
        const sel = window.getSelection();
        if (sel.rangeCount && editor.contains(sel.anchorNode)) {
          savedRange = sel.getRangeAt(0).cloneRange();
        }
        openKatexModal({
          initialLatex: '',
          initialClasses: [],
          onInsert: ({ latex, classes, fontSize }) => {
            editor.focus();
            if (savedRange) {
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(savedRange);
            }
            insertKatexAtSelectionWithFormatting(editor, latex, classes, fontSize);
            renderKatexInEditor(editor);
          },
          onCancel: () => {}
        });
      });
    }
  });
}

function removeOption(index) {
  const options = getCurrentOptions();
  options.splice(index, 1);
  rebuildOptions(options, 0);
}

// Save Question
document.getElementById('save-question').addEventListener('click', () => {
  const text = document.getElementById('q-editor').innerHTML.trim();
  const type = document.getElementById('answer-type').value;
  const tags = document.getElementById('question-tags').value
    .split(',')
    .map(t => t.trim())
    .filter(t => t);
  const explanation = document.getElementById('e-editor').innerHTML.trim();
  if (!text) {
    toast('Please enter question text', 'error');
    return;
  }
  let question = { text, type, tags, explanation };
  if (type === 'typed') {
    let answer = document.getElementById('a-editor').innerHTML.trim();
    const aEditor = document.getElementById('a-editor');
    if (!answer) {
      toast('Please enter an answer', 'error');
      return;
    }
    // If math-font is present or math symbols are present, wrap in span.math-font
    if (aEditor.classList.contains('math-font') || /[∫∑∏√∞≈≠≤≥∂∇∃∀∈∉∋αβγδεζηθικλμνξοπρστυφχψω]/.test(answer)) {
      if (!/^<span class=["']math-font["']/.test(answer)) {
        answer = `<span class="math-font">${answer}</span>`;
      }
    }
    question.answer = answer;
  } else {
    const options = getCurrentOptions();
    const correctIndex = Array.from(document.getElementsByName('correct-option')).findIndex(r => r.checked);
    if (options.length < 2) {
      toast('Please add at least 2 options', 'error');
      return;
    }
    if (correctIndex === -1) {
      toast('Please select a correct answer', 'error');
      return;
    }
    question.options = options;
    question.correctIndex = correctIndex;
  }
  const tx = db.transaction(STORE_Q, 'readwrite');
  const store = tx.objectStore(STORE_Q);
  const saveOperation = new Promise((resolve, reject) => {
    if (editQuestionId) {
      question.id = editQuestionId;
      const request = store.put(question);
      request.onsuccess = () => resolve({ question, isNew: false });
      request.onerror = () => reject(request.error);
    } else {
      const request = store.add(question);
      request.onsuccess = (e) => {
        question.id = e.target.result;
        resolve({ question, isNew: true });
      };
      request.onerror = () => reject(request.error);
    }
  });
  saveOperation
    .then(({ question, isNew }) => {
      // Store the ID of the edited/added question
      lastEditedQuestionId = question.id;
      
      // Show success message
      toast(isNew ? 'Question added' : 'Question updated', 'success');
      
      // Reload questions and show the questions page
      loadQuestionsList().then(() => {
        showPage('questions');
      });
    })
    .catch(error => {
      console.error('Error saving question:', error);
      toast('Error saving question', 'error');
    });
});

// -------------------- Modules Manage & CRUD --------------------
function loadModulesManage() {
  const list = document.getElementById('module-manage-list');
  list.innerHTML = '';
  const filter = document.getElementById('module-search').value.trim().toLowerCase();
  // Show loading state
  list.innerHTML = '<div class="spinner"></div>';
  
  const tx = db.transaction(STORE_M, 'readonly');
  const store = tx.objectStore(STORE_M);
  let modules = [];
  
  store.openCursor().onsuccess = e => {
    const cur = e.target.result;
    if (cur) {
      modules.push(cur.value);
      cur.continue();
      return;
    }
    
    // Filter modules by name if search term exists
    if (filter) {
      modules = modules.filter(m => m.name.toLowerCase().includes(filter));
    }
    
    // Update modules count in the UI
    updateModulesCount(modules.length);
    
    if (modules.length === 0) {
      list.innerHTML = '<div class="empty-state">No modules available. Create your first module!</div>';
    } else {
      modules.sort((a, b) => b.id - a.id);
      list.innerHTML = '';
      modules.forEach(m => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.qid = m.id;
        const hdr = document.createElement('div');
        hdr.className = 'card-header';
        let statusText = '';
        if (m.type === 'exam' && m.examCompleted) {
          statusText = '<span class="badge module-status locked">Exam completed</span>';
        } else {
          statusText = `<span class="badge module-status ${m.locked ? 'locked' : 'unlocked'}">${m.locked ? 'Locked' : 'Unlocked'}</span>`;
        }
        hdr.innerHTML = `
          <div>
            <strong>${m.name}</strong>
            ${statusText}
            <div class="summary">${m.description}</div>
            <small>${m.questions.length} questions</small>
          </div>
          <div class="card-actions" style="align-items:center;">
            ${['Eye', 'Edit', 'Delete', m.locked ? 'Unlock' : 'Lock', 'Export']
              .map(icon => `
                <button class="icon-btn" title="${icon}">
                  <img src="icons/${icon}.svg" alt="${icon}">
                </button>
              `).join('')}
          </div>
        `;
        // Add event listeners
        const [viewBtn, editBtn, deleteBtn, lockBtn, exportBtn] = 
          hdr.querySelectorAll('.icon-btn');
        viewBtn.addEventListener('click', () => viewModuleQuestions(m.id));
        editBtn.addEventListener('click', () => openModuleEditor(m));
        deleteBtn.addEventListener('click', () => confirmDeleteModule(m.id));
        lockBtn.addEventListener('click', () => toggleModuleLock(m));
        exportBtn.addEventListener('click', () => exportModule(m));
        // Add reset progress button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'icon-btn';
        resetBtn.title = 'Reset Progress';
        resetBtn.innerHTML = '<img src="icons/Refresh.svg" alt="Reset">';
        resetBtn.addEventListener('click', () => restartModule(m.id));
        hdr.querySelector('.card-actions').appendChild(resetBtn);
        card.append(hdr);
        list.append(card);
      });
      return;
    }
    // Remove duplicate code that was causing modules to be added twice
  };
}

document.getElementById('module-search').addEventListener('input', loadModulesManage);
document.getElementById('create-module').addEventListener('click', ()=> openModuleEditor());
document.getElementById('import-modules').addEventListener('click', ()=> {
  openModal('Import Modules', `<input type="file" id="import-mod-file" accept=".json">`, [{
    text:'Import', class:'btn', onClick:() => {
      const file = document.getElementById('import-mod-file').files[0];
      const reader = new FileReader();
      reader.onload = e => {
        const arr = JSON.parse(e.target.result);
        const tx = db.transaction(STORE_M,'readwrite'), store = tx.objectStore(STORE_M);
        arr.forEach(m=> store.put(m));
        tx.oncomplete = ()=> { toast('Imported modules'); loadModulesManage(); };
      };
      reader.readAsText(file);
    }
  }]);
});

// Module Editor
let editModuleId=null;
function openModuleEditor(m=null) {
  editModuleId = m ? m.id : null;
  document.getElementById('module-edit-title').textContent = m ? 'Edit Module' : 'Create Module';
  showPage('module-edit');
  // Move shuffle toggle below module name and above description
  let shuffleDiv = document.getElementById('shuffle-toggle-group');
  if (!shuffleDiv) {
    shuffleDiv = document.createElement('div');
    shuffleDiv.className = 'form-group';
    shuffleDiv.id = 'shuffle-toggle-group';
    shuffleDiv.innerHTML = `
      <label style="display:flex;align-items:center;gap:0.75rem;">
        <input type="checkbox" id="shuffle-toggle" style="width:1.2rem;height:1.2rem;"> Shuffle questions in this module
      </label>
    `;
    const form = document.getElementById('module-edit');
    const nameGroup = form.querySelector('.form-group');
    const descGroup = form.querySelectorAll('.form-group')[1];
    form.insertBefore(shuffleDiv, descGroup); // Place after name, before description
  }
  const shuffleCheckbox = document.getElementById('shuffle-toggle');
  if (m && typeof m.shuffle === 'boolean') {
    moduleShuffle = m.shuffle;
    shuffleCheckbox.checked = m.shuffle;
  } else {
    moduleShuffle = false;
    shuffleCheckbox.checked = false;
  }
  shuffleCheckbox.addEventListener('change', e => {
    moduleShuffle = e.target.checked;
  });
  // Set up exam module checkbox and exam fields
  const examCheckbox = document.getElementById('module-type-exam');
  const examFields = document.getElementById('exam-fields');
  if (m) {
    document.getElementById('module-name').value = m.name;
    document.getElementById('m-editor').innerHTML = m.description;
    examCheckbox.checked = m.type === 'exam';
    document.getElementById('exam-date').value = m.examDate || '';
    document.getElementById('exam-time').value = m.examTime || '';
    document.getElementById('exam-duration').value = m.examDuration || '';
    examFields.style.display = (m.type === 'exam') ? '' : 'none';
    populateModuleQuestions(m.questions);
    updateBreadcrumb('modules', { action: 'edit', moduleName: m.name });
  } else {
    document.getElementById('module-name').value = '';
    document.getElementById('m-editor').innerHTML = '';
    examCheckbox.checked = false;
    document.getElementById('exam-date').value = '';
    document.getElementById('exam-time').value = '';
    document.getElementById('exam-duration').value = '';
    examFields.style.display = 'none';
    populateModuleQuestions([]);
    updateBreadcrumb('modules', { action: 'create' });
  }
  // Show/hide exam fields on checkbox change
  examCheckbox.onchange = () => {
    examFields.style.display = examCheckbox.checked ? '' : 'none';
  };
}
document.getElementById('cancel-module-edit').addEventListener('click', ()=>showPage('modules'));

// --- Add search and tag filter for module question selection ---
// Add global state for module question search, tag filter, and selection
let moduleQuestionSearch = '';

// Update modules count in the UI
function updateModulesCount(count) {
  const countElement = document.getElementById('modules-count');
  if (countElement) {
    if (count !== undefined) {
      countElement.textContent = `${count} ${count === 1 ? 'module' : 'modules'}`;
    } else {
      const tx = db.transaction(STORE_M, 'readonly');
      const store = tx.objectStore(STORE_M);
      const countRequest = store.count();
      
      countRequest.onsuccess = function() {
        countElement.textContent = `${countRequest.result} ${countRequest.result === 1 ? 'module' : 'modules'}`;
      };
    }
  }
}

// Update questions count in the UI
function updateQuestionsCount() {
  const countElement = document.getElementById('questions-count');
  if (countElement) {
    const tx = db.transaction(STORE_Q, 'readonly');
    const store = tx.objectStore(STORE_Q);
    const countRequest = store.count();
    
    countRequest.onsuccess = function() {
      countElement.textContent = `${countRequest.result} ${countRequest.result === 1 ? 'question' : 'questions'}`;
    };
  }
}
let moduleTagFilter = '';
let moduleSelectedQuestions = [];

// Update populateModuleQuestions for better design and scroll
function populateModuleQuestions(selected = []) {
  // Store selected globally for in-place updates
  moduleSelectedQuestions = selected.slice();
  const cont = document.getElementById('module-question-select');
  cont.innerHTML = '';
  // Add search bar and tag filter UI if not present
  let searchBar = document.getElementById('module-question-search-bar');
  if (!searchBar) {
    searchBar = document.createElement('div');
    searchBar.id = 'module-question-search-bar';
    searchBar.style.display = 'flex';
    searchBar.style.gap = '1rem';
    searchBar.style.marginBottom = '1rem';
    searchBar.style.position = 'sticky';
    searchBar.style.top = '0';
    searchBar.style.background = 'var(--bg-primary)';
    searchBar.style.zIndex = '2';
    searchBar.style.padding = '0.5rem 0';
    // Remove Select Page button, add Select All checkbox
    searchBar.innerHTML = `
      <input id="module-question-search" class="form-control" placeholder="Search questions..." style="max-width:300px;">
      <input id="module-tag-filter" class="form-control" placeholder="Filter by tag..." style="max-width:200px;">
      <label style="display:flex;align-items:center;gap:0.5rem;font-weight:500;">
        <input type="checkbox" id="select-all-questions"> Select All
      </label>
    `;
    cont.parentElement.insertBefore(searchBar, cont);
    document.getElementById('module-question-search').addEventListener('input', e => {
      moduleQuestionSearch = e.target.value.trim().toLowerCase();
      populateModuleQuestions(moduleSelectedQuestions);
    });
    document.getElementById('module-tag-filter').addEventListener('input', e => {
      moduleTagFilter = e.target.value.trim().toLowerCase();
      populateModuleQuestions(moduleSelectedQuestions);
    });
  }
  // Make the question list scrollable and styled
  cont.style.maxHeight = '400px';
  cont.style.overflowY = 'auto';
  cont.style.background = 'var(--bg-secondary)';
  cont.style.border = '1.5px solid var(--border)';
  cont.style.borderRadius = '12px';
  cont.style.padding = '1rem';
  cont.style.marginBottom = '1.5rem';
  // Gather all tags for filter suggestions (optional: could be used for dropdown)
  const tx = db.transaction(STORE_Q, 'readonly'), store = tx.objectStore(STORE_Q);
  const allQuestions = [];
  store.openCursor().onsuccess = e => {
    const cur = e.target.result;
    if (!cur) {
      // Filter questions by search and tag
      let filtered = allQuestions;
      if (moduleQuestionSearch) {
        filtered = filtered.filter(q => q.text.toLowerCase().includes(moduleQuestionSearch));
      }
      if (moduleTagFilter) {
        const searchTags = moduleTagFilter.toLowerCase().split(/\s+/).filter(tag => tag.trim() !== '');
        filtered = filtered.filter(q => {
          const qTags = q.tags.map(tag => tag.toLowerCase());
          return searchTags.every(searchTag => 
            qTags.some(qTag => qTag.includes(searchTag))
          );
        });
      }
      if (filtered.length === 0) {
        cont.innerHTML = '<div class="empty-state">No questions match your search/filter.</div>';
        return;
      }
      filtered.forEach(q => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.qid = q.id;
        card.style.marginBottom = '1rem';
        card.style.padding = '1.25rem';
        card.style.border = '1px solid var(--border)';
        card.style.borderRadius = '10px';
        card.style.background = 'var(--bg-primary)';
        card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
        // Selection visual
        if (moduleSelectedQuestions.includes(q.id)) {
          card.classList.add('selected');
          card.style.border = '2.5px solid var(--primary)';
          card.style.background = '#fff3e0';
          card.style.position = 'relative';
          // Add checkmark
          let check = document.createElement('span');
          check.innerHTML = '✓';
          check.style.position = 'absolute';
          check.style.top = '12px';
          check.style.right = '18px';
          check.style.fontSize = '1.5rem';
          check.style.color = 'var(--primary-dark)';
          card.appendChild(check);
        }
        // Toggle selection on click (in-place, no reload)
        card.addEventListener('click', (e) => {
          if (e.target.closest('.expand-btn') || e.target.closest('.tag')) return;
          const qid = q.id;
          const idx = moduleSelectedQuestions.indexOf(qid);
          if (idx !== -1) {
            moduleSelectedQuestions.splice(idx, 1);
            card.classList.remove('selected');
            card.style.border = '1px solid var(--border)';
            card.style.background = 'var(--bg-primary)';
            // Remove checkmark if present
            const check = card.querySelector('span[style*="position: absolute"]');
            if (check) check.remove();
          } else {
            moduleSelectedQuestions.push(qid);
            card.classList.add('selected');
            card.style.border = '2.5px solid var(--primary)';
            card.style.background = '#fff3e0';
            card.style.position = 'relative';
            // Add checkmark if not already present
            if (!card.querySelector('span[style*="position: absolute"]')) {
              let check = document.createElement('span');
              check.innerHTML = '✓';
              check.style.position = 'absolute';
              check.style.top = '12px';
              check.style.right = '18px';
              check.style.fontSize = '1.5rem';
              check.style.color = 'var(--primary-dark)';
              check.style.pointerEvents = 'none';
              card.appendChild(check);
            }
          }
        });
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'flex-start';
        label.style.gap = '1rem';
        // Remove checkbox, just use content
        const content = document.createElement('div');
        const summaryText = q.text.replace(/<img[^>]*>/g, '');
        content.innerHTML = `
          <div class="question-text" style="font-weight:500;">${summaryText}</div>
      <div class="tags" style="margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${q.tags.map(tag => `
          <span class="tag" style="
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 0.25rem 0.65rem;
            font-size: 0.85rem;
            color: var(--text-secondary);
            white-space: nowrap;
            line-height: 1.4;
          ">${tag}</span>
        `).join('')}
      </div>
    `;
        renderKatexInline(content);
        const expandBtn = document.createElement('button');
        expandBtn.className = 'icon-btn expand-btn';
        expandBtn.innerHTML = '<img src="icons/Chevron Down.svg" alt="Expand">';
        expandBtn.style.marginLeft = 'auto';
        expandBtn.addEventListener('click', (e) => {
          e.preventDefault();
          card.classList.toggle('expanded');
          expandBtn.querySelector('img').style.transform = card.classList.contains('expanded') ? 'rotate(180deg)' : '';
        });
        const answerSection = document.createElement('div');
        answerSection.className = 'answer-section';
        answerSection.style.marginTop = '0.75rem';
        if (q.type === 'typed') {
          const answerNeedsMathFont2 = needsMathFont(q.answer);
          answerSection.innerHTML = `<div class="full-text">${q.text}</div><div class="answer ${answerNeedsMathFont2 ? 'math-font' : ''}"><strong>Answer:</strong><br>${applyFontDelimiters(q.answer)}</div>`;
          renderKatexInline(answerSection);
        } else {
          // MCQ: render options as buttons with correct/incorrect classes and math-font
          let html = '<div class="full-text">' + q.text + '</div><div class="answer"><strong>Answer:</strong><br><ul class="quiz-options">';
          q.options.forEach((opt, i) => {
            const cls = i === q.correctIndex ? 'correct' : '';
            const mathFont = needsMathFont(opt) ? 'math-font' : '';
            html += `<li><button class="${cls} ${mathFont}">${String.fromCharCode(65 + i)}. <span class="option-text${mathFont ? ' math-font' : ''}">${applyFontDelimiters(opt)}</span></button></li>`;
          });
          html += '</ul></div>';
          answerSection.innerHTML = html;
          renderKatexInline(answerSection);
        }
        label.append(content);
        card.append(label, expandBtn, answerSection);
        cont.append(card);
      });
      // --- Select All Checkbox Logic ---
      setTimeout(() => {
        const selectAllCheckbox = document.getElementById('select-all-questions');
        if (!selectAllCheckbox) return;
        // Get all visible card qids
        const visibleCards = cont.querySelectorAll('.card');
        const visibleQids = Array.from(visibleCards).map(card => Number(card.dataset.qid));
        const selectedVisible = visibleQids.filter(qid => moduleSelectedQuestions.includes(qid));
        if (selectedVisible.length === 0) {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = false;
        } else if (selectedVisible.length === visibleQids.length) {
          selectAllCheckbox.checked = true;
          selectAllCheckbox.indeterminate = false;
        } else {
          selectAllCheckbox.checked = false;
          selectAllCheckbox.indeterminate = true;
        }
        selectAllCheckbox.onchange = function() {
          if (this.checked) {
            // Add all visible qids to selection
            visibleQids.forEach(qid => {
              if (!moduleSelectedQuestions.includes(qid)) moduleSelectedQuestions.push(qid);
            });
          } else {
            // Remove all visible qids from selection
            moduleSelectedQuestions = moduleSelectedQuestions.filter(qid => !visibleQids.includes(qid));
          }
          // Update visuals in-place
          visibleCards.forEach(card => {
            const qid = Number(card.dataset.qid);
            const isSelected = moduleSelectedQuestions.includes(qid);
            const existingCheck = card.querySelector('span[style*="position: absolute"]');
            
            if (isSelected) {
              card.classList.add('selected');
              card.style.border = '2.5px solid var(--primary)';
              card.style.background = '#fff3e0';
              card.style.position = 'relative';
              if (!existingCheck) {
                let check = document.createElement('span');
                check.innerHTML = '✓';
                check.style.position = 'absolute';
                check.style.top = '12px';
                check.style.right = '18px';
                check.style.fontSize = '1.5rem';
                check.style.color = 'var(--primary-dark)';
                check.style.pointerEvents = 'none';
                card.appendChild(check);
              }
            } else {
              card.classList.remove('selected');
              card.style.border = '1px solid var(--border)';
              card.style.background = 'var(--bg-primary)';
              if (existingCheck) {
                existingCheck.remove();
              }
            }
          });
          // Update the checkbox state (indeterminate/checked)
          if (visibleQids.every(qid => moduleSelectedQuestions.includes(qid))) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
          } else if (visibleQids.some(qid => moduleSelectedQuestions.includes(qid))) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
          } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
          }
        };
      }, 0);
      // --- End Select All Checkbox Logic ---
      return;
    }
    allQuestions.push(cur.value);
    cur.continue();
  };
}

// --- Add shuffle toggle to module editor ---
// Add a global for shuffle state
let moduleShuffle = false;

// Update save-module to include shuffle property and loading state
const saveModuleBtn = document.getElementById('save-module');
saveModuleBtn.addEventListener('click', ()=>{
  const name = document.getElementById('module-name').value.trim();
  const desc = document.getElementById('m-editor').innerHTML.trim();
  const qids = Array.from(document.querySelectorAll('#module-question-select .card.selected'))
                   .map(card => Number(card.dataset.qid));
  const shuffle = document.getElementById('shuffle-toggle') ? document.getElementById('shuffle-toggle').checked : false;
  const isExam = document.getElementById('module-type-exam').checked;
  const examDate = document.getElementById('exam-date').value;
  const examTime = document.getElementById('exam-time').value;
  const examDuration = document.getElementById('exam-duration').value;
  if (!name) {
    toast('Please enter module name', 'error');
    return;
  }
  if (isExam && (!examDate || !examTime || !examDuration)) {
    toast('Please fill all exam fields', 'error');
    return;
  }
  // ... spinner ...
  const m = { name, description: desc, questions: qids, locked: false, shuffle, type: isExam ? 'exam' : 'quiz' };
  if (isExam) {
    m.examDate = examDate;
    m.examTime = examTime;
    m.examDuration = Number(examDuration);
    m.examCompleted = false; // Always set to false on creation
  }
  // ... save to DB as before ...
  const tx = db.transaction(STORE_M,'readwrite');
  const store = tx.objectStore(STORE_M);
  
  // Add error handling
  const handleError = (error) => {
    console.error('Error saving module:', error);
    toast('Error saving module', 'error');
    saveModuleBtn.disabled = false;
    saveModuleBtn.innerHTML = originalBtnText;
  };
  
  // Add transaction completion handler
  tx.oncomplete = () => {
    // Small delay to ensure UI updates are smooth
    setTimeout(() => {
      saveModuleBtn.disabled = false;
      saveModuleBtn.innerHTML = originalBtnText;
      showPage('modules');
    }, 300);
  };
  
  tx.onerror = (e) => {
    console.error('Transaction error:', e);
    handleError(e);
  };
  
  if (editModuleId) {
    m.id = editModuleId;
    const request = store.put(m);
    request.onsuccess = () => {
      toast('Module updated', 'success');
      loadModulesManage();
      reloadHomeIfActive();
    };
    request.onerror = handleError;
  } else {
    const request = store.add(m);
    request.onsuccess = (e) => {
      m.id = e.target.result;
      toast('Module created', 'success');
      loadModulesManage();
      reloadHomeIfActive();
    };
    request.onerror = handleError;
  }
});

// Module Actions
function confirmDeleteModule(id) {
  openModal('Confirm Delete', 'Delete this module?', [
    {text:'Delete', onClick:()=>{
      const tx = db.transaction(STORE_M,'readwrite'), store=tx.objectStore(STORE_M);
      store.delete(id).onsuccess = ()=>{ toast('Deleted'); loadModulesManage(); reloadHomeIfActive(); };
    }, close: true},
    {text:'Cancel', close: true}
  ]);
}

function toggleModuleLock(m) {
  m.locked = !m.locked;
  const tx = db.transaction(STORE_M,'readwrite'), store=tx.objectStore(STORE_M);
  store.put(m).onsuccess = ()=> { loadModulesManage(); reloadHomeIfActive(); };
}

function exportModule(m) {
  const blob = new Blob([JSON.stringify(m)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=`module_${m.id}.json`; a.click();
  toast('Exported module');
}

function viewModuleQuestions(mid) {
  getModuleById(mid).then(m => {
    if (!m.questions.length) {
      openModal(m.name, '<p>No questions in this module.</p>', [{ text: 'Close', close: true }]);
      return;
    }
    const tx = db.transaction(STORE_Q, 'readonly');
    const store = tx.objectStore(STORE_Q);
    const qids = m.questions;
    const questions = [];
    let count = 0;
    qids.forEach(qid => {
      store.get(qid).onsuccess = e => {
        const q = e.target.result;
        if (q) questions.push(q);
        count++;
        if (count === qids.length) {
          let html = '<div class="card-list">';
          questions.forEach(q => {
            const card = document.createElement('div');
            card.className = 'card question-card';
            card.setAttribute('data-id', q.id);
            const hdr = document.createElement('div');
            hdr.className = 'card-header';
            const headerContent = document.createElement('div');
            headerContent.className = 'card-header-content';
            const summary = document.createElement('div');
            summary.className = 'summary';
            summary.innerHTML = q.text.replace(/<img[^>]*>/g, '');
            renderKatexInline(summary);
            const fullText = document.createElement('div');
            fullText.className = 'full-text';
            fullText.innerHTML = q.text;
            renderKatexInline(fullText);
            const tags = document.createElement('div');
            tags.className = 'tags';
            q.tags.forEach(tag => {
              const tagEl = document.createElement('span');
              tagEl.className = 'tag';
              tagEl.textContent = tag;
              tags.appendChild(tagEl);
            });
            headerContent.append(summary, fullText, tags);
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            const expandBtn = document.createElement('button');
            expandBtn.className = 'icon-btn';
            expandBtn.innerHTML = '<img src="icons/Chevron Down.svg" alt="Expand">';
            expandBtn.addEventListener('click', () => {
              card.classList.toggle('expanded');
              expandBtn.querySelector('img').style.transform = card.classList.contains('expanded') ? 'rotate(180deg)' : '';
            });
            actions.append(expandBtn);
            hdr.append(headerContent, actions);
            const body = document.createElement('div');
            body.className = 'card-body';
            if (q.type === 'typed') {
              const answerNeedsMathFont3 = needsMathFont(q.answer);
              body.innerHTML = `<div class="${answerNeedsMathFont3 ? 'math-font' : ''}"><strong>Answer:</strong><br>${applyFontDelimiters(q.answer)}</div>`;
              renderKatexInline(body);
            } else {
              // MCQ: render options as buttons with correct/incorrect classes and math-font
              let html = '<div><strong>Answer:</strong><br><ul class="quiz-options">';
              q.options.forEach((opt, i) => {
                const cls = i === q.correctIndex ? 'correct' : '';
                const mathFont = needsMathFont(opt) ? 'math-font' : '';
                html += `<li><button class="${cls} ${mathFont}">${String.fromCharCode(65 + i)}. <span class="option-text${mathFont ? ' math-font' : ''}">${applyFontDelimiters(opt)}</span></button></li>`;
              });
              html += '</ul></div>';
              body.innerHTML = html;
              renderKatexInline(body);
            }
            card.append(hdr, body);
            html += card.outerHTML;
          });
          html += '</div>';
          openModal(m.name, html, [{ text: 'Close', close: true }]);
          setTimeout(() => {
            document.querySelectorAll('.modal .question-card .icon-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                const card = this.closest('.question-card');
                card.classList.toggle('expanded');
                this.querySelector('img').style.transform = card.classList.contains('expanded') ? 'rotate(180deg)' : '';
              });
            });
          }, 100);
        }
      };
    });
  });
}

// -------------------- Initialize --------------------
function initApp() {
  openDB();
}

// -------------------- App Export/Import --------------------
// Global state for import comparison
let importComparisonState = {
  questions: { new: [], updated: [], duplicates: [] },
  modules: { new: [], updated: [], duplicates: [] },
  userState: { new: null, existing: null },
  selected: {
    questions: { new: true, updated: true, duplicates: false },
    modules: { new: true, updated: true, duplicates: false },
    userState: true
  }
};

function exportAllData() {
  const tx = db.transaction([STORE_Q, STORE_M, STORE_U], 'readonly');
  const questions = tx.objectStore(STORE_Q).getAll();
  const modules = tx.objectStore(STORE_M).getAll();
  const userState = tx.objectStore(STORE_U).getAll();
  
  Promise.all([questions, modules, userState]).then(([questions, modules, userState]) => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      questions,
      modules,
      userState
    };
    
    // Create and trigger download
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `limit-app-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast('All data exported successfully!', 'success');
  }).catch(error => {
    console.error('Export failed:', error);
    toast('Failed to export data: ' + error.message, 'error');
  });
}

async function analyzeImportData(importData) {
  // Reset state
  importComparisonState = {
    questions: { new: [], updated: [], duplicates: [] },
    modules: { new: [], updated: [], duplicates: [] },
    userState: { new: importData.userState?.[0] || null, existing: null },
    selected: {
      questions: { new: true, updated: true, duplicates: false },
      modules: { new: true, updated: true, duplicates: false },
      userState: true
    }
  };

  // Get existing data for comparison
  const [existingQuestions, existingModules, existingUserState] = await Promise.all([
    getAllFromStore(STORE_Q),
    getAllFromStore(STORE_M),
    getFromStore(STORE_U, 'userState')
  ]);

  importComparisonState.userState.existing = existingUserState || {};

  // Analyze questions
  const existingQuestionsMap = new Map(existingQuestions.map(q => [q.id, q]));
  const existingQuestionTexts = new Set(existingQuestions.map(q => q.text.toLowerCase().trim()));
  
  for (const question of importData.questions || []) {
    const existingQuestion = existingQuestionsMap.get(question.id);
    
    if (!existingQuestion) {
      // Check for duplicates by text
      const isDuplicate = existingQuestions.some(q => 
        q.text.toLowerCase().trim() === question.text.toLowerCase().trim()
      );
      
      if (isDuplicate) {
        importComparisonState.questions.duplicates.push({
          new: question,
          existing: existingQuestions.find(q => 
            q.text.toLowerCase().trim() === question.text.toLowerCase().trim()
          ),
          action: 'skip' // default action
        });
      } else {
        importComparisonState.questions.new.push({
          ...question,
          action: 'add' // default action
        });
      }
    } else if (JSON.stringify(question) !== JSON.stringify(existingQuestion)) {
      importComparisonState.questions.updated.push({
        new: question,
        existing: existingQuestion,
        action: 'update' // default action
      });
    }
  }

  // Analyze modules
  const existingModulesMap = new Map(existingModules.map(m => [m.id, m]));
  const existingModuleNames = new Set(existingModules.map(m => m.name.toLowerCase().trim()));
  
  for (const module of importData.modules || []) {
    const existingModule = existingModulesMap.get(module.id);
    
    if (!existingModule) {
      // Check for duplicates by name
      const isDuplicate = existingModules.some(m => 
        m.name.toLowerCase().trim() === module.name.toLowerCase().trim()
      );
      
      if (isDuplicate) {
        importComparisonState.modules.duplicates.push({
          new: module,
          existing: existingModules.find(m => 
            m.name.toLowerCase().trim() === module.name.toLowerCase().trim()
          ),
          action: 'skip' // default action
        });
      } else {
        importComparisonState.modules.new.push({
          ...module,
          action: 'add' // default action
        });
      }
    } else if (JSON.stringify(module) !== JSON.stringify(existingModule)) {
      importComparisonState.modules.updated.push({
        new: module,
        existing: existingModule,
        action: 'update' // default action
      });
    }
  }

  return importComparisonState;
}

function showImportComparison(comparison) {
  const modal = document.getElementById('import-comparison-modal');
  if (!modal) return;

  // Update summary counts
  document.getElementById('new-items-count').textContent = 
    comparison.questions.new.length + comparison.modules.new.length;
  document.getElementById('updated-items-count').textContent = 
    comparison.questions.updated.length + comparison.modules.updated.length;
  document.getElementById('duplicate-items-count').textContent = 
    comparison.questions.duplicates.length + comparison.modules.duplicates.length;

  // Render sections
  renderImportSection('new-questions', comparison.questions.new, 'question');
  renderUpdatedSection('updated-questions', comparison.questions.updated, 'question');
  renderDuplicateSection('duplicate-questions', comparison.questions.duplicates, 'question');
  
  renderImportSection('new-modules', comparison.modules.new, 'module');
  renderUpdatedSection('updated-modules', comparison.modules.updated, 'module');
  renderDuplicateSection('duplicate-modules', comparison.modules.duplicates, 'module');

  // Show modal
  modal.style.display = 'block';

  // Add tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = e.target.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      e.target.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Close modal handlers
  document.getElementById('close-comparison-modal').onclick = () => {
    modal.style.display = 'none';
  };
  
  document.getElementById('cancel-import').onclick = () => {
    modal.style.display = 'none';
  };

  // Confirm import
  document.getElementById('confirm-import').onclick = async () => {
    try {
      const tx = db.transaction([STORE_Q, STORE_M, STORE_U], 'readwrite');
      
      // Process questions
      for (const item of comparison.questions.new) {
        if (item.action === 'add') {
          tx.objectStore(STORE_Q).add(item);
        }
      }
      
      for (const item of comparison.questions.updated) {
        if (item.action === 'update') {
          tx.objectStore(STORE_Q).put(item.new);
        }
      }
      
      for (const item of comparison.questions.duplicates) {
        if (item.action === 'replace') {
          tx.objectStore(STORE_Q).put(item.new);
        }
      }
      
      // Process modules
      for (const item of comparison.modules.new) {
        if (item.action === 'add') {
          tx.objectStore(STORE_M).add(item);
        }
      }
      
      for (const item of comparison.modules.updated) {
        if (item.action === 'update') {
          tx.objectStore(STORE_M).put(item.new);
        }
      }
      
      for (const item of comparison.modules.duplicates) {
        if (item.action === 'replace') {
          tx.objectStore(STORE_M).put(item.new);
        }
      }
      
      // Process user state
      if (comparison.selected.userState && comparison.userState.new) {
        tx.objectStore(STORE_U).put(comparison.userState.new);
      }
      
      await tx.complete;
      
      modal.style.display = 'none';
      toast('Import completed successfully!', 'success');
      
      // Refresh the UI
      if (currentPage === 'questions') loadQuestionsList();
      if (currentPage === 'modules') loadModulesManage();
      
    } catch (error) {
      console.error('Import failed:', error);
      toast('Failed to import data: ' + (error.message || 'Unknown error'), 'error');
    }
  };
}

function renderImportSection(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = items.length === 0 
    ? '<div class="empty-state">No items</div>'
    : items.map(item => `
      <div class="import-item" data-id="${item.id}">
        <div class="import-item-header">
          <h4 class="import-item-title">
            ${type === 'question' 
              ? item.text.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...'
              : item.name}
          </h4>
          <div class="import-item-actions">
            <button class="import-item-btn keep ${item.action === 'add' ? 'active' : ''}" 
                    data-action="add">
              Keep
            </button>
          </div>
        </div>
        <div class="import-item-preview">
          ${type === 'question' 
            ? item.tags?.length ? `Tags: ${item.tags.join(', ')}` : 'No tags'
            : item.description?.substring(0, 100) || 'No description'}
        </div>
      </div>
    `).join('');

  // Add event listeners
  container.querySelectorAll('.import-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = e.target.closest('.import-item').dataset.id;
      const action = e.target.dataset.action;
      
      // Update UI
      const itemButtons = e.target.closest('.import-item-actions').querySelectorAll('.import-item-btn');
      itemButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Update state
      const item = items.find(i => i.id === itemId);
      if (item) {
        item.action = action;
      }
    });
  });
}

function renderUpdatedSection(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = items.length === 0 
    ? '<div class="empty-state">No items</div>'
    : items.map(item => `
      <div class="import-item" data-id="${item.new.id}">
        <div class="import-item-header">
          <h4 class="import-item-title">
            ${type === 'question' 
              ? item.new.text.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...'
              : item.new.name}
          </h4>
          <div class="import-item-actions">
            <button class="import-item-btn keep ${item.action === 'update' ? 'active' : ''}" 
                    data-action="update">
              Keep New
            </button>
            <button class="import-item-btn discard ${item.action === 'skip' ? 'active' : ''}" 
                    data-action="skip">
              Keep Existing
            </button>
          </div>
        </div>
        <div class="import-item-diff">
          ${generateDiffPreview(item.existing, item.new, type)}
        </div>
      </div>
    `).join('');

  // Add event listeners
  container.querySelectorAll('.import-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = e.target.closest('.import-item').dataset.id;
      const action = e.target.dataset.action;
      
      // Update UI
      const itemButtons = e.target.closest('.import-item-actions').querySelectorAll('.import-item-btn');
      itemButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Update state
      const item = items.find(i => i.new.id === itemId);
      if (item) {
        item.action = action === 'update' ? 'update' : 'skip';
      }
    });
  });
}

function renderDuplicateSection(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  container.innerHTML = items.length === 0 
    ? '<div class="empty-state">No items</div>'
    : items.map(item => `
      <div class="import-item" data-id="${item.new.id}">
        <div class="import-item-header">
          <h4 class="import-item-title">
            ${type === 'question' 
              ? item.new.text.replace(/<[^>]*>?/gm, '').substring(0, 50) + '...'
              : item.new.name}
          </h4>
          <div class="import-item-actions">
            <button class="import-item-btn keep ${item.action === 'replace' ? 'active' : ''}" 
                    data-action="replace">
              Replace
            </button>
            <button class="import-item-btn discard ${item.action === 'skip' ? 'active' : ''}" 
                    data-action="skip">
              Keep Existing
            </button>
          </div>
        </div>
        <div class="import-item-preview">
          ${type === 'question' 
            ? item.new.tags?.length ? `Tags: ${item.new.tags.join(', ')}` : 'No tags'
            : item.new.description?.substring(0, 100) || 'No description'}
        </div>
      </div>
    `).join('');

  // Add event listeners
  container.querySelectorAll('.import-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const itemId = e.target.closest('.import-item').dataset.id;
      const action = e.target.dataset.action;
      
      // Update UI
      const itemButtons = e.target.closest('.import-item-actions').querySelectorAll('.import-item-btn');
      itemButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      
      // Update state
      const item = items.find(i => i.new.id === itemId);
      if (item) {
        item.action = action === 'replace' ? 'replace' : 'skip';
      }
    });
  });
}

function generateDiffPreview(oldItem, newItem, type) {
  let diff = '<div class="diff-container">';
  
  if (type === 'question') {
    // Compare question text
    if (oldItem.text !== newItem.text) {
      diff += `
        <div class="diff-row">
          <span class="diff-label">Question:</span>
          <div class="diff-content">
            <div class="diff-removed">${oldItem.text.replace(/<[^>]*>?/gm, '').substring(0, 100)}...</div>
            <div class="diff-added">${newItem.text.replace(/<[^>]*>?/gm, '').substring(0, 100)}...</div>
          </div>
        </div>`;
    }
    
    // Compare answer if exists
    if (oldItem.answer !== newItem.answer) {
      diff += `
        <div class="diff-row">
          <span class="diff-label">Answer:</span>
          <div class="diff-content">
            <div class="diff-removed">${oldItem.answer ? oldItem.answer.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...' : 'None'}</div>
            <div class="diff-added">${newItem.answer ? newItem.answer.replace(/<[^>]*>?/gm, '').substring(0, 100) + '...' : 'None'}</div>
          </div>
        </div>`;
    }
    
    // Compare tags
    const oldTags = new Set(oldItem.tags || []);
    const newTags = new Set(newItem.tags || []);
    const addedTags = [...newTags].filter(tag => !oldTags.has(tag));
    const removedTags = [...oldTags].filter(tag => !newTags.has(tag));
    
    if (addedTags.length > 0 || removedTags.length > 0) {
      diff += `
        <div class="diff-row">
          <span class="diff-label">Tags:</span>
          <div class="diff-content">`;
      
      if (removedTags.length > 0) {
        diff += `<div class="diff-removed">Removed: ${removedTags.join(', ')}</div>`;
      }
      
      if (addedTags.length > 0) {
        diff += `<div class="diff-added">Added: ${addedTags.join(', ')}</div>`;
      }
      
      diff += `</div></div>`;
    }
    
  } else if (type === 'module') {
    // Compare module name
    if (oldItem.name !== newItem.name) {
      diff += `
        <div class="diff-row">
          <span class="diff-label">Name:</span>
          <div class="diff-content">
            <div class="diff-removed">${oldItem.name}</div>
            <div class="diff-added">${newItem.name}</div>
          </div>
        </div>`;
    }
    
    // Compare description
    if (oldItem.description !== newItem.description) {
      diff += `
        <div class="diff-row">
          <span class="diff-label">Description:</span>
          <div class="diff-content">
            <div class="diff-removed">${oldItem.description || 'No description'}</div>
            <div class="diff-added">${newItem.description || 'No description'}</div>
          </div>
        </div>`;
    }
  }
  
  diff += '</div>';
  return diff;
}

async function importData(file) {
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Validate the imported data
      if (!data.questions || !Array.isArray(data.questions) || 
          !data.modules || !Array.isArray(data.modules) || 
          !data.userState || !Array.isArray(data.userState)) {
        throw new Error('Invalid data format');
      }
      
      // Analyze the import data
      const comparison = await analyzeImportData(data);
      
      // Show the comparison UI
      showImportComparison(comparison);
      
    } catch (error) {
      console.error('Import failed:', error);
      toast('Invalid import file: ' + (error.message || 'Unknown error'), 'error');
    }
  };
  
  reader.onerror = () => {
    toast('Error reading file', 'error');
  };
  
  reader.readAsText(file);
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  // Initialize database
  openDB();
  
  // Set up export/import handlers
  document.getElementById('export-all-data')?.addEventListener('click', exportAllData);
  
  const importBtn = document.getElementById('import-all-data');
  const importInput = document.getElementById('import-file-input');
  
  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => {
      importInput.click();
    });
    
    importInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        importData(e.target.files[0]);
        // Reset input to allow re-importing the same file
        e.target.value = '';
      }
    });
  }
  
  // Theme switcher
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    // Function to update the theme select based on current theme
    const updateThemeSelect = (theme) => {
      themeSelect.value = theme;
      applyTheme(theme);
    };

    // Load saved theme from IndexedDB, fallback to localStorage/system
    getThemeFromDB().then(dbTheme => {
      let savedTheme = dbTheme || localStorage.getItem('theme') || 'system';
      updateThemeSelect(savedTheme);
      // Save to both DB and localStorage for redundancy
      saveThemeToDB(savedTheme);
      localStorage.setItem('theme', savedTheme);
    });

    // Save theme preference when changed
    themeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      saveThemeToDB(theme);
      localStorage.setItem('theme', theme);
      updateThemeSelect(theme);
    });

    // Update theme when system preference changes (only when in system mode)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (themeSelect.value === 'system') {
        applyTheme('system');
      }
    });
  }
});

function applyTheme(theme) {
  const root = document.documentElement;
  
  // Save the theme preference
  if (theme === 'system') {
    // Remove any explicit theme and let CSS handle it
    root.removeAttribute('data-theme');
    
    // Check system preference
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.classList.toggle('dark-mode', isDark);
  } else {
    // Set explicit theme
    root.setAttribute('data-theme', theme);
    document.body.classList.toggle('dark-mode', theme === 'dark');
  }
  
  // Force a reflow to ensure the transition happens
  document.body.offsetHeight;
}

// Export all app data to a JSON file
async function exportAllData() {
  try {
    // Get all data from IndexedDB
    const [modules, questions, userState] = await Promise.all([
      getAllModules(),
      getAllQuestions(),
      getUserState()
    ]);

    // Create export object with version and timestamp
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        modules,
        questions,
        userState
      }
    };

    // Create a blob and download link
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    // Create and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `math-app-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    
    toast('Data exported successfully!', 'success');
  } catch (error) {
    console.error('Export failed:', error);
    toast('Failed to export data. Please try again.', 'error');
  }
}

// Helper function to get all modules
function getAllModules() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['modules'], 'readonly');
    const store = transaction.objectStore('modules');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper function to get all questions
function getAllQuestions() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['questions'], 'readonly');
    const store = transaction.objectStore('questions');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Helper function to get user state
function getUserState() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['userState'], 'readonly');
    const store = transaction.objectStore('userState');
    const request = store.get('current');
    
    request.onsuccess = () => resolve(request.result || {});
    request.onerror = () => reject(request.error);
  });
}

// Import data from a JSON file
async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        // Validate the imported data structure
        if (!jsonData || !jsonData.data || 
            typeof jsonData.data !== 'object' || 
            !Array.isArray(jsonData.data.modules) || 
            !Array.isArray(jsonData.data.questions)) {
          throw new Error('Invalid data format. Please import a valid export file.');
        }
        
        const { modules, questions, userState } = jsonData.data;
        
        // Start a transaction for all imports
        const transaction = db.transaction(
          ['modules', 'questions', 'userState'], 
          'readwrite'
        );
        
        // Import modules
        const modulesStore = transaction.objectStore('modules');
        await Promise.all(modules.map(module => 
          new Promise((resolveModule, rejectModule) => {
            const request = modulesStore.put(module);
            request.onsuccess = resolveModule;
            request.onerror = () => rejectModule(new Error('Failed to import module: ' + module.id));
          })
        ));
        
        // Import questions
        const questionsStore = transaction.objectStore('questions');
        await Promise.all(questions.map(question => 
          new Promise((resolveQuestion, rejectQuestion) => {
            const request = questionsStore.put(question);
            request.onsuccess = resolveQuestion;
            request.onerror = () => rejectQuestion(new Error('Failed to import question: ' + question.id));
          })
        ));
        
        // Import user state if it exists
        if (userState) {
          const userStateStore = transaction.objectStore('userState');
          await new Promise((resolveUserState, rejectUserState) => {
            const request = userStateStore.put(userState, 'current');
            request.onsuccess = resolveUserState;
            request.onerror = () => rejectUserState(new Error('Failed to import user state'));
          });
        }
        
        // Complete the transaction
        transaction.oncomplete = () => {
          toast('Data imported successfully!', 'success');
          resolve();
          
          // Refresh the UI if we're on a page that displays this data
          if (typeof loadModules === 'function') {
            loadModules();
          }
          if (typeof loadQuestions === 'function') {
            loadQuestions();
          }
        };
        
        transaction.onerror = (error) => {
          console.error('Import transaction error:', error);
          reject(new Error('Failed to complete import transaction'));
        };
        
      } catch (error) {
        console.error('Import error:', error);
        toast(error.message || 'Failed to import data. The file may be corrupted or in an invalid format.', 'error');
        reject(error);
      }
    };
    
    reader.onerror = () => {
      const error = new Error('Error reading file');
      toast(error.message, 'error');
      reject(error);
    };
    
    // Start reading the file
    reader.readAsText(file);
  });
}

// Initialize system theme change listener
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (document.getElementById('theme-select')?.value === 'system') {
    applyTheme('system');
  }
});

// Initialize app when database is ready
window.onload = openDB;

// 1. Utility to replace \font ... /font with <span class="math-font">...</span>
function applyFontDelimiters(html) {
  return html.replace(/\\font([\s\S]*?)\/font/g, function(_, content) {
    return '<span class="math-font">' + content + '</span>';
  });
}

// 4. In renderQuiz, hide the progress bars (accuracy/progress) when on the quiz page.
document.querySelectorAll('.progress-container').forEach(el => el.style.display = 'none');

// 5. Improve the action bar and search bar design in index.html and app.js as described.

// 2. On Home button click, show spinner, then after a short delay, call loadModulesHome
const homeBtn = document.querySelector('nav .nav-btn[data-page="home"]');
homeBtn.addEventListener('click', () => {
  showPage('home');
  const list = document.getElementById('module-list');
  list.innerHTML = '<div class="spinner"></div>';
  setTimeout(() => loadModulesHome(), 600);
});

// 3. When module data changes, if Home page is active, reload modules with spinner
function reloadHomeIfActive() {
  if (document.getElementById('home').classList.contains('active')) {
    const list = document.getElementById('module-list');
    list.innerHTML = '<div class="spinner"></div>';
    setTimeout(() => loadModulesHome(), 600);
  }
}

// Add a helper function at the top:
function needsMathFont(html) {
  return /class=["']math-font["']/.test(html) || /[∫∑∏√∞≈≠≤≥∂∇∃∀∈∉∋αβγδεζηθικλμνξοπρστυφχψω]/.test(html);
}

function showCompletionMessage(moduleId, accuracy) {
  const quizContent = document.getElementById('quiz-content');
  quizContent.innerHTML = `
    <div class="quiz-header" style="margin-bottom: 1.5rem;">
      <button class="btn btn-secondary" onclick="showPage('home');loadModulesHome();">
        <img src="icons/Back.svg" alt=""> Back to Home
      </button>
    </div>
    <div class="completion-message" style="background: var(--card-bg); padding: 3rem; border-radius: var(--radius-lg); text-align: center; box-shadow: var(--card-shadow); max-width: 800px; margin: 2rem auto;">
      <div style="font-size: 3rem; margin-bottom: 1.5rem;">🎉</div>
      <h3 style="margin-bottom: 1rem; color: var(--text-primary); font-size: 2rem;">Module Completed!</h3>
      <p style="color: var(--text-secondary); margin-bottom: 2.5rem; font-size: 1.1rem;">You completed this module with <strong style="color: var(--primary); font-size: 1.2em;">${accuracy}%</strong> accuracy.</p>
      <div class="completion-actions" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <button class="btn" onclick="showModuleReview(${moduleId})" style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; font-size: 1rem; border-radius: var(--radius);">
          <img src="icons/Review.svg" alt="" style="width: 18px; height: 18px;"> Review Answers
        </button>
      </div>
    </div>
  `;
  // Optionally, mark as completed in userState
  getUserState(moduleId).then(state => {
    if (!state.completed) {
      state.completed = true;
      saveUserState(state);
    }
  });
}

// Show module review with questions in the order they were solved
function showModuleReview(moduleId) {
  getModuleById(moduleId).then(module => {
    getUserState(moduleId).then(state => {
      Promise.all(module.questions.map(qid => getQuestionById(qid))).then(questions => {
        const questionMap = {};
        questions.forEach(q => { questionMap[q.id] = q; });
        let reviewData = [];
        if (state.done && Array.isArray(state.done)) {
          reviewData = state.done.map((doneItem, index) => {
            const question = questionMap[doneItem.id];
            if (!question) return null;
            // Fix: use hasOwnProperty to distinguish 0 from null/undefined
            const userAnswer = (doneItem.hasOwnProperty('answer')) ? doneItem.answer : (question.type === 'mcq' ? null : '');
            const isCorrect = (typeof doneItem.correct !== 'undefined') ? doneItem.correct : false;
            return { question, userAnswer, isCorrect, index };
          }).filter(Boolean);
        }
        const answeredIds = state.done && Array.isArray(state.done) ? new Set(state.done.map(d => d.id)) : new Set();
        const unansweredQuestions = questions.filter(q => !answeredIds.has(q.id));
        unansweredQuestions.forEach((question, i) => {
          reviewData.push({
            question,
            userAnswer: question.type === 'mcq' ? null : '',
            isCorrect: false,
            index: reviewData.length + i
          });
        });
        if (reviewData.length > 0) {
          showReviewModal(reviewData, 0);
        } else {
          toast('No questions to review', 'info');
        }
      });
    });
  });
}

function showReviewModal(reviewData, currentIndex) {
  const total = reviewData.length;
  const { question, userAnswer, isCorrect, index } = reviewData[currentIndex];
  // Build review card HTML
  let tagsHTML = '';
  if (question.tags && question.tags.length) {
    tagsHTML = `<div class="tags">${question.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}</div>`;
  }
  const cardHTML = `
    <div class="card question-card expanded" data-id="${question.id}" style="max-width:100%;overflow-x:hidden;">
      <div class="card-header">
        <div class="card-header-content">
          <div class="question-number">Question ${index + 1} of ${total}</div>
          <div class="summary">${applyFontDelimiters(question.text.replace(/<img[^>]*>/g, ''))}</div>
          <div class="full-text" style="display:block;">${applyFontDelimiters(question.text)}</div>
          ${tagsHTML}
        </div>
        <div class="card-actions">
          ${isCorrect ? `<span class="question-status correct">Correct</span>` : ''}
        </div>
      </div>
      <div class="card-body">
        ${generateAnswerReviewHTML(question, userAnswer, isCorrect)}
      </div>
    </div>
  `;
  // Modal footer buttons
  const footerBtns = [];
  if (currentIndex > 0) {
    footerBtns.push({
      text: 'Previous',
      class: 'btn btn-secondary',
      onClick: () => showReviewModal(reviewData, currentIndex - 1),
      close: false
    });
  }
  if (currentIndex < total - 1) {
    footerBtns.push({
      text: 'Next',
      class: 'btn',
      onClick: () => showReviewModal(reviewData, currentIndex + 1),
      close: false
    });
  }
  footerBtns.push({
    text: 'Close',
    class: 'btn btn-secondary',
    onClick: () => {},
    close: true
  });
  openModal('Module Review', cardHTML, footerBtns);
  setTimeout(() => {
    const modalBody = document.getElementById('modal-body');
    if (modalBody) renderKatexInline(modalBody);
    if (window.renderMathInElement && modalBody) {
      renderMathInElement(modalBody, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '$', right: '$', display: false},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ]
      });
    }
  }, 100);
}

function generateAnswerReviewHTML(question, userAnswer, isCorrect) {
  if (question.type === 'mcq') {
    return generateMCQReviewHTML(question, userAnswer, isCorrect);
  } else {
    return generateTypedReviewHTML(question, userAnswer, isCorrect);
  }
}

function generateMCQReviewHTML(question, userAnswer, isCorrect) {
  // Stack MCQ options vertically in review modal
  let optionsHTML = '<div class="review-mcq-options" style="display:flex;flex-direction:column;gap:1.2rem;">';
  question.options.forEach((option, index) => {
    const isCorrectOption = index === question.correctIndex;
    const isUserChoice = (userAnswer !== null && userAnswer !== undefined && Number(userAnswer) === index);
    let cardStyle = [
      'padding:1.5rem 1.5rem',
      'border-radius:1.5rem',
      'background:' + (isCorrectOption ? 'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)' : isUserChoice ? 'linear-gradient(135deg,#ff5858 0%,#f09819 100%)' : 'rgba(255,255,255,0.7)'),
      'color:' + (isCorrectOption || isUserChoice ? '#fff' : 'var(--text-primary)'),
      'box-shadow:0 2px 12px rgba(32,178,170,0.10)',
      'position:relative',
      'transition:all 0.3s cubic-bezier(.4,0,.2,1)'
    ];
    let badge = '';
    if (isCorrectOption) badge = `<span style="position:absolute;top:1rem;right:1rem;background:rgba(67,233,123,0.95);color:#fff;border-radius:50%;width:2.2rem;height:2.2rem;display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 2px 8px rgba(67,233,123,0.18);animation:popIn 0.5s;">\u2714</span>`;
    if (isUserChoice && !isCorrectOption) badge = `<span style="position:absolute;top:1rem;right:1rem;background:rgba(255,88,88,0.95);color:#fff;border-radius:50%;width:2.2rem;height:2.2rem;display:flex;align-items:center;justify-content:center;font-size:1.3rem;box-shadow:0 2px 8px rgba(255,88,88,0.18);animation:shake 0.5s;">\u2716</span>`;
    const mathFont = needsMathFont(option) ? ' math-font' : '';
    optionsHTML += `<div class="mcq-option${mathFont}" style="${cardStyle.join(';')}">${applyFontDelimiters(option)}${badge}</div>`;
  });
  optionsHTML += '</div>';
  // Add explanation box if present
  if (question.explanation && question.explanation.trim()) {
    optionsHTML += `<div class="explanation-box" style="margin-top:2.5rem;background:rgba(255,255,255,0.7);border-radius:1.2rem;box-shadow:0 2px 8px rgba(32,178,170,0.07);font-size:1.15rem;line-height:1.7;padding:1.5rem 2rem;"><strong style="color:#38f9d7;">Explanation:</strong><br>${question.explanation}</div>`;
  }
  return optionsHTML;
}

function generateTypedReviewHTML(question, userAnswer, isCorrect) {
  const correctNeedsMath = needsMathFont(question.answer);
  let html = `
    <div class="answer-comparison" style="grid-template-columns:1fr;max-width:100%;overflow-x:hidden;">
      <div class="answer-section correct-answer${correctNeedsMath ? ' math-font' : ''}">
        <h4>Correct Answer</h4>
        ${applyFontDelimiters(question.answer)}
      </div>
    </div>
  `;
  // Add explanation box if present
  if (question.explanation && question.explanation.trim()) {
    html += `<div class="explanation-box" style="margin-top:1.5rem;"><strong>Explanation:</strong><br>${question.explanation}</div>`;
  }
  return html;
}

// Add event listener for the back button
const backButton = document.getElementById('back-to-modules');
if (backButton) {
  backButton.addEventListener('click', () => {
    showPage('home');
  });
}

// Function to create a table with the specified number of rows and columns
function createTable(rows, cols) {
  let table = document.createElement('table');
  table.className = 'rich-table';
  table.setAttribute('contenteditable', 'false');
  
  // Create table header
  let thead = document.createElement('thead');
  let headerRow = document.createElement('tr');
  
  // Add an empty header cell at the start for the row controls
  let emptyHeader = document.createElement('th');
  emptyHeader.style.width = '30px';
  headerRow.appendChild(emptyHeader);
  
  // Add column headers (A, B, C, ...)
  for (let i = 0; i < cols; i++) {
    let th = document.createElement('th');
    th.textContent = String.fromCharCode(65 + i); // A, B, C, ...
    th.style.minWidth = '100px';
    headerRow.appendChild(th);
  }
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create table body
  let tbody = document.createElement('tbody');
  
  // Add rows with row headers (1, 2, 3, ...)
  for (let i = 0; i < rows; i++) {
    let tr = document.createElement('tr');
    
    // Add row header
    let rowHeader = document.createElement('th');
    rowHeader.textContent = (i + 1).toString();
    tr.appendChild(rowHeader);
    
    // Add cells
    for (let j = 0; j < cols; j++) {
      let td = document.createElement('td');
      td.setAttribute('contenteditable', 'true');
      td.innerHTML = '&nbsp;'; // Add non-breaking space to make cells selectable
      
      // Add table controls on cell hover
      td.addEventListener('mouseenter', function(e) {
        const rect = this.getBoundingClientRect();
        const controls = this.querySelector('.table-controls') || document.createElement('div');
        
        if (!controls.classList.contains('table-controls')) {
          controls.className = 'table-controls';
          
          const addRowBtn = document.createElement('button');
          addRowBtn.title = 'Add Row';
          addRowBtn.innerHTML = '⤵️';
          addRowBtn.onclick = (e) => {
            e.stopPropagation();
            const newRow = this.parentElement.cloneNode(true);
            this.parentElement.parentElement.insertBefore(newRow, this.parentElement.nextSibling);
            // Clear the new row's content
            newRow.querySelectorAll('td[contenteditable="true"]').forEach(cell => {
              cell.innerHTML = '&nbsp;';
            });
          };
          
          const addColBtn = document.createElement('button');
          addColBtn.title = 'Add Column';
          addColBtn.innerHTML = '⤵️';
          addColBtn.style.transform = 'rotate(90deg)';
          addColBtn.onclick = (e) => {
            e.stopPropagation();
            const row = this.parentElement;
            const cellIndex = Array.from(row.children).indexOf(this);
            
            // Add a cell to each row at the same position
            const rows = row.parentElement.querySelectorAll('tr');
            rows.forEach(r => {
              const newCell = document.createElement('td');
              newCell.setAttribute('contenteditable', 'true');
              newCell.innerHTML = '&nbsp;';
              
              // Insert the new cell at the correct position
              if (r === row) {
                r.insertBefore(newCell, this.nextSibling);
              } else {
                // For other rows, insert at the same index
                const cells = r.querySelectorAll('td');
                if (cells.length > cellIndex - 1) { // -1 because of the row header
                  r.insertBefore(newCell, cells[cellIndex - 1].nextSibling);
                } else {
                  r.appendChild(newCell);
                }
              }
            });
          };
          
          const deleteBtn = document.createElement('button');
          deleteBtn.title = 'Delete';
          deleteBtn.innerHTML = '❌';
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Delete this table?')) {
              const table = this.closest('table');
              table.parentNode.removeChild(table);
            }
          };
          
          controls.appendChild(addRowBtn);
          controls.appendChild(addColBtn);
          controls.appendChild(deleteBtn);
          this.appendChild(controls);
        }
        
        controls.style.display = 'flex';
        controls.style.top = (rect.top - 30) + 'px';
        controls.style.left = rect.left + 'px';
      });
      
      td.addEventListener('mouseleave', function() {
        const controls = this.querySelector('.table-controls');
        if (controls) {
          // Don't hide if mouse is over controls
          if (!controls.matches(':hover')) {
            controls.style.display = 'none';
          } else {
            // Hide after leaving controls
            controls.addEventListener('mouseleave', function hideControls() {
              this.style.display = 'none';
              this.removeEventListener('mouseleave', hideControls);
            });
          }
        }
      });
      
      tr.appendChild(td);
    }
    
    tbody.appendChild(tr);
  }
  
  table.appendChild(tbody);
  
  // Add table wrapper for better styling
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';
  wrapper.style.margin = '10px 0';
  wrapper.appendChild(table);
  
  return wrapper;
}

// Show table insertion modal
function showTableInsertModal(editor) {
  const modal = document.getElementById('table-insert-modal');
  const cancelBtn = modal.querySelector('.cancel-btn');
  const insertBtn = modal.querySelector('.insert-btn');
  const rowsInput = document.getElementById('table-rows');
  const colsInput = document.getElementById('table-cols');
  
  // Reset inputs
  rowsInput.value = 3;
  colsInput.value = 3;
  
  // Show modal
  modal.style.display = 'flex';
  
  // Focus the rows input for better UX
  setTimeout(() => rowsInput.focus(), 100);
  
  // Handle cancel
  const cancelHandler = () => {
    modal.style.display = 'none';
    cancelBtn.removeEventListener('click', cancelHandler);
    insertBtn.removeEventListener('click', insertHandler);
  };
  
  // Handle insert
  const insertHandler = () => {
    const rows = parseInt(rowsInput.value) || 3;
    const cols = parseInt(colsInput.value) || 3;
    
    // Validate input
    if (rows < 1 || rows > 10 || cols < 1 || cols > 10) {
      alert('Please enter values between 1 and 10');
      return;
    }
    
    // Create and insert table
    const table = createTable(rows, cols);
    
    // Insert at cursor position or at the end
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(table);
      
      // Add a new line after the table
      const br = document.createElement('br');
      table.parentNode.insertBefore(document.createTextNode('\u00A0'), table.nextSibling);
      table.parentNode.insertBefore(br, table.nextSibling);
      
      // Move cursor after the table
      const newRange = document.createRange();
      newRange.setStartAfter(br);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } else {
      editor.appendChild(table);
      editor.appendChild(document.createElement('br'));
    }
    
    // Hide modal
    cancelHandler();
  };
  
  // Add event listeners
  cancelBtn.addEventListener('click', cancelHandler);
  insertBtn.addEventListener('click', insertHandler);
  
  // Handle Escape key
  const keydownHandler = (e) => {
    if (e.key === 'Escape') {
      cancelHandler();
      document.removeEventListener('keydown', keydownHandler);
    } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
      insertHandler();
    }
  };
  
  document.addEventListener('keydown', keydownHandler);
}

// Initialize table functionality for all rich text editors
function initAllTableFunctionality() {
  console.log('Initializing table functionality for all editors...');
  
  // Try to find all rich text editors
  const editors = [];
  
  // Check for the main question editor
  const qEditor = document.getElementById('q-editor');
  if (qEditor) editors.push(qEditor);
  
  // Check for the answer editor
  const aEditor = document.getElementById('a-editor');
  if (aEditor) editors.push(aEditor);
  
  // Check for the explanation editor
  const eEditor = document.getElementById('e-editor');
  if (eEditor) editors.push(eEditor);
  
  // Also find any other contenteditable elements with -editor in their ID
  const otherEditors = document.querySelectorAll('[contenteditable="true"][id$="-editor"]');
  otherEditors.forEach(editor => {
    if (!editors.includes(editor)) {
      editors.push(editor);
    }
  });
  
  console.log(`Found ${editors.length} editors to initialize:`, editors.map(e => e.id));
  
  // Initialize each editor
  editors.forEach(editor => {
    if (editor && editor.id) {
      console.log(`Initializing editor: ${editor.id}`);
      initTableFunctionality(editor);
    }
  });
  
  // Also initialize for any dynamically added editors
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          const newEditors = [];
          
          // Check if the node itself is an editor
          if (node.hasAttribute('contenteditable') && node.id && node.id.endsWith('-editor')) {
            newEditors.push(node);
          }
          
          // Check for nested editors
          const nestedEditors = node.querySelectorAll ? 
            node.querySelectorAll('[contenteditable="true"][id$="-editor"]') : [];
          nestedEditors.forEach(editor => newEditors.push(editor));
          
          // Initialize any found editors
          newEditors.forEach(editor => {
            if (editor && editor.id && !editors.includes(editor)) {
              console.log(`Found new editor to initialize: ${editor.id}`);
              editors.push(editor);
              initTableFunctionality(editor);
            }
          });
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('Table functionality initialization complete');
}

// Debug function to check if an image exists
function checkImageExists(url, callback) {
  const img = new Image();
  img.onload = function() { callback(true); };
  img.onerror = function() { callback(false); };
  img.src = url;
}

// Function to check element visibility
function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && 
         style.visibility !== 'hidden' && 
         style.opacity !== '0' &&
         el.offsetWidth > 0 && 
         el.offsetHeight > 0;
}

document.addEventListener('DOMContentLoaded', function() {
  // Check if Table.svg exists
  checkImageExists('icons/Table.svg', function(exists) {
    console.log('Table.svg exists:', exists);
    if (!exists) {
      console.error('Table.svg not found at: icons/Table.svg');
    } else {
      console.log('Table.svg path is correct');
    }
  });
  
  // Debug: Check if table button is in the DOM and visible
  setTimeout(() => {
    const tableBtn = document.querySelector('.insert-table-btn');
    console.log('Table button in DOM:', tableBtn ? 'Found' : 'Not found');
    
    if (tableBtn) {
      console.log('Table button visibility:', isElementVisible(tableBtn) ? 'Visible' : 'Hidden');
      console.log('Table button styles:', window.getComputedStyle(tableBtn));
      console.log('Table button parent visibility:', isElementVisible(tableBtn.parentElement) ? 'Parent visible' : 'Parent hidden');
      
      // Force make it visible for debugging
      tableBtn.style.display = 'inline-flex';
      tableBtn.style.visibility = 'visible';
      tableBtn.style.opacity = '1';
      tableBtn.style.position = 'relative';
      tableBtn.style.zIndex = '9999';
      tableBtn.style.backgroundColor = '#ffeb3b';
      tableBtn.style.border = '2px solid #f44336';
    }
  }, 1000);
  
  // Initialize table functionality for all rich text editors
  initAllTableFunctionality();
  
  // Add event listener for the Add Question button
  const addQuestionBtn = document.getElementById('add-question');
  if (addQuestionBtn) {
    addQuestionBtn.addEventListener('click', () => {
      // Reinitialize table functionality when the question editor is opened
      setTimeout(() => {
        initAllTableFunctionality();
      }, 100);
    });
  }
  // Home button click
  const homeBtn = document.querySelector('nav .nav-btn[data-page="home"]');
  if (homeBtn) {
    homeBtn.addEventListener('click', () => {
      showPage('home');
      const list = document.getElementById('module-list');
      list.innerHTML = '<div class="spinner"></div>';
      setTimeout(() => loadModulesHome(), 600);
    });
  }

  // Back to modules button in review page
  const backBtn = document.getElementById('back-to-modules');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      showPage('home');
    });
  }

  // Hide progress bars on load (if needed)
  document.querySelectorAll('.progress-container').forEach(el => el.style.display = 'none');
});

// --- Custom KaTeX Modal with Formatting ---
function openKatexModal({
  initialLatex = '',
  initialClasses = [],
  onInsert,
  onCancel
}) {
  let latex = initialLatex;
  let classes = new Set(initialClasses);
  let fontSize = 1; // em
  // Modal HTML
  const modalBody = document.createElement('div');
  modalBody.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:1.2rem;min-width:420px;max-width:700px;">
      <div class="rich-toolbar" id="katex-toolbar" style="margin-bottom:0;flex-wrap:wrap;gap:0.5rem 1.2rem;justify-content:flex-start;">
        <button type="button" data-cmd="bold" title="Bold"><img src="icons/Bold.svg" alt="Bold"></button>
        <button type="button" data-cmd="italic" title="Italic"><img src="icons/Italics.svg" alt="Italic"></button>
        <button type="button" data-cmd="underline" title="Underline"><img src="icons/Underline.svg" alt="Underline"></button>
        <button type="button" data-cmd="strikeThrough" title="Strikethrough"><img src="icons/Strikethrough.svg" alt="Strikethrough"></button>
        <button type="button" data-cmd="increaseFont" title="Increase Font Size"><img src="icons/FontUp.svg" alt="A+" style="width:1.1rem;height:1.1rem;"></button>
        <button type="button" data-cmd="decreaseFont" title="Decrease Font Size"><img src="icons/FontDown.svg" alt="A-" style="width:1.1rem;height:1.1rem;"></button>
      </div>
      <label style="font-weight:500;">LaTeX Equation</label>
      <textarea id="katex-input" style="width:100%;min-height:80px;font-size:1.2em;padding:0.8em 1em;border-radius:10px;border:2px solid var(--border);resize:vertical;max-width:100%;"></textarea>
      <label style="font-weight:500;">Preview</label>
      <div id="katex-preview" style="min-height:3em;padding:1em 1.5em;background:var(--bg-secondary);border-radius:12px;border:2px solid var(--border);font-size:1.4em;max-width:100%;overflow-x:auto;"></div>
    </div>
  `;
  // Insert/Cancel buttons
  const footerBtns = [
    { text: 'Cancel', class: 'btn btn-secondary', onClick: onCancel, close: true },
    { text: 'Insert', class: 'btn', onClick: () => {
      onInsert({ latex, classes: Array.from(classes), fontSize });
    }, close: true }
  ];
  openModal('Insert Equation', modalBody.innerHTML, footerBtns);
  // Get elements
  const input = document.getElementById('katex-input');
  const preview = document.getElementById('katex-preview');
  const toolbar = document.getElementById('katex-toolbar');
  input.value = latex;
  // Helper to update preview
  function updatePreview() {
    preview.className = Array.from(classes).join(' ');
    preview.style.fontSize = fontSize + 'em';
    try {
      preview.innerHTML = '';
      katex.render(input.value, preview, { throwOnError: false, displayMode: false, plugins: [window.katexMhchem] });
    } catch (e) {
      preview.innerHTML = '<span style="color:red">Invalid LaTeX</span>';
    }
  }
  // Initial preview
  updatePreview();
  // Input event
  input.addEventListener('input', () => {
    latex = input.value;
    updatePreview();
  });
  // Toolbar events
  toolbar.querySelectorAll('button[data-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.cmd;
      if (cmd === 'bold') {
        if (classes.has('bold')) classes.delete('bold'); else classes.add('bold');
      } else if (cmd === 'italic') {
        if (classes.has('italic')) classes.delete('italic'); else classes.add('italic');
      } else if (cmd === 'underline') {
        if (classes.has('underline')) classes.delete('underline'); else classes.add('underline');
      } else if (cmd === 'strikeThrough') {
        if (classes.has('strikethrough')) classes.delete('strikethrough'); else classes.add('strikethrough');
      } else if (cmd === 'increaseFont') {
        fontSize = Math.min(fontSize + 0.1, 2);
      } else if (cmd === 'decreaseFont') {
        fontSize = Math.max(fontSize - 0.1, 0.7);
      }
      updatePreview();
    });
  });
}

// --- Patch rich text editor to use custom modal ---
function getFormattingClassesFromSpan(span) {
  const classes = [];
  if (span.classList.contains('bold')) classes.push('bold');
  if (span.classList.contains('italic')) classes.push('italic');
  if (span.classList.contains('underline')) classes.push('underline');
  if (span.classList.contains('strikethrough')) classes.push('strikethrough');
  return classes;
}

function getFontSizeFromSpan(span) {
  if (span.style.fontSize) {
    const match = span.style.fontSize.match(/([\d.]+)em/);
    if (match) return parseFloat(match[1]);
  }
  return 1;
}

// Add robust math input normalization
function normalizeMathInput(html) {
  // Convert <sup>...</sup> to ^(...)
  html = html.replace(/<sup>(.*?)<\/sup>/gi, '^($1)');
  // Convert Unicode superscripts to ^
  const superMap = {
    '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
    '⁺': '+', '⁻': '-', '⁼': '=', '⁽': '(', '⁾': ')', 'ⁿ': 'n'
  };
  html = html.replace(/[\u2070-\u2079\u00b9\u00b2\u00b3\u207a-\u207eⁿ]/g, c => '^' + (superMap[c] || c));
  // Convert <sub>...</sub> to _(...)
  html = html.replace(/<sub>(.*?)<\/sub>/gi, '_($1)');
  // Convert Unicode subscripts to _
  const subMap = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    '₊': '+', '₋': '-', '₌': '=', '₍': '(', '₎': ')'
  };
  html = html.replace(/[\u2080-\u2089₊₋₌₍₎]/g, c => '_' + (subMap[c] || c));
  // Remove all HTML tags
  let text = html.replace(/<[^>]+>/g, '');
  // Replace math symbols
  text = text.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  // Remove whitespace
  text = text.replace(/\s+/g, '');
  // Insert * for implicit multiplication (e.g., 4x -> 4*x, 2(x+1) -> 2*(x+1))
  text = text.replace(/(\d)([a-zA-Z(])/g, '$1*$2');
  text = text.replace(/([a-zA-Z)])(\d)/g, '$1*$2');
  // Remove double **
  text = text.replace(/\*\*/g, '*');
  return text;
}

// Add keyframes for popIn and shake animations (inject into <style> if not present)
(function ensureFeedbackAnimations() {
  if (!document.getElementById('feedback-animations')) {
    const style = document.createElement('style');
    style.id = 'feedback-animations';
    style.innerHTML = `
      @keyframes popIn {
        0% { transform: scale(0.7); opacity: 0; }
        60% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes shake {
        0% { transform: translateX(0); }
        20% { transform: translateX(-8px); }
        40% { transform: translateX(8px); }
        60% { transform: translateX(-6px); }
        80% { transform: translateX(6px); }
        100% { transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }
})();

// Add keyframes for moveGradient animation if not present
(function ensureModuleCardGradientAnimation() {
  if (!document.getElementById('module-card-gradient-anim')) {
    const style = document.createElement('style');
    style.id = 'module-card-gradient-anim';
    style.innerHTML = `
      @keyframes moveGradient {
        0% {background-position:0% 50%}
        50% {background-position:100% 50%}
        100% {background-position:0% 50%}
      }
    `;
    document.head.appendChild(style);
  }
})();

// Helper: Replace $...$ or $$...$$ with KaTeX span in a contenteditable div
function autoRenderKatexInEditor(editor) {
  if (!editor) return;
  // Only operate on direct text nodes (not inside existing .katex-equation)
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
  const nodesToReplace = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement.closest('.katex-equation')) {
      nodesToReplace.push(node);
    }
  }
  nodesToReplace.forEach(node => {
    let text = node.nodeValue;
    // Regex for $...$ (not $$...$$)
    text = text.replace(/\$(?!\$)([^$]+?)\$/g, (match, latex) => {
      const span = document.createElement('span');
      span.className = 'katex-equation';
      span.setAttribute('data-latex', latex.trim());
      span.contentEditable = 'false';
      // Add .katex-render and .katex-toolbar
      const renderSpan = document.createElement('span');
      renderSpan.className = 'katex-render';
      span.appendChild(renderSpan);
      const toolbar = document.createElement('span');
      toolbar.className = 'katex-toolbar';
      toolbar.innerHTML = `\n        <button type="button" class="katex-edit" title="Edit"><img src="icons/Edit.svg" alt="Edit" style="width:1.1em;height:1.1em;"></button>\n        <button type="button" class="katex-delete" title="Delete"><img src="icons/Delete.svg" alt="Delete" style="width:1.1em;height:1.1em;"></button>\n      `;
      span.appendChild(toolbar);
      try {
        renderSpan.innerHTML = '';
        katex.render(latex.trim(), renderSpan, { throwOnError: false, displayMode: false, plugins: [window.katexMhchem] });
      } catch (e) {
        renderSpan.innerHTML = '<span style="color:red">Invalid LaTeX</span>';
      }
      // Attach toolbar events
      toolbar.querySelector('.katex-edit').onclick = (e) => {
        e.stopPropagation();
        const initialLatex = span.getAttribute('data-latex') || '';
        openKatexModal({
          initialLatex,
          initialClasses: [],
          onInsert: ({ latex }) => {
            span.setAttribute('data-latex', latex);
            renderKatexInEditor(editor);
          },
          onCancel: () => {}
        });
      };
      toolbar.querySelector('.katex-delete').onclick = (e) => {
        e.stopPropagation();
        span.remove();
      };
      // Return a marker for later replacement
      const marker = `[[KATEX-${Math.random().toString(36).substr(2, 8)}]]`;
      autoRenderKatexInEditor._markers = autoRenderKatexInEditor._markers || {};
      autoRenderKatexInEditor._markers[marker] = span.outerHTML;
      return marker;
    });
    // Regex for $$...$$ (display mode)
    text = text.replace(/\$\$([^$]+?)\$\$/g, (match, latex) => {
      const span = document.createElement('span');
      span.className = 'katex-equation';
      span.setAttribute('data-latex', latex.trim());
      span.contentEditable = 'false';
      // Add .katex-render and .katex-toolbar
      const renderSpan = document.createElement('span');
      renderSpan.className = 'katex-render';
      span.appendChild(renderSpan);
      const toolbar = document.createElement('span');
      toolbar.className = 'katex-toolbar';
      toolbar.innerHTML = `\n        <button type="button" class="katex-edit" title="Edit"><img src="icons/Edit.svg" alt="Edit" style="width:1.1em;height:1.1em;"></button>\n        <button type="button" class="katex-delete" title="Delete"><img src="icons/Delete.svg" alt="Delete" style="width:1.1em;height:1.1em;"></button>\n      `;
      span.appendChild(toolbar);
      try {
        renderSpan.innerHTML = '';
        katex.render(latex.trim(), renderSpan, { throwOnError: false, displayMode: true, plugins: [window.katexMhchem] });
      } catch (e) {
        renderSpan.innerHTML = '<span style="color:red">Invalid LaTeX</span>';
      }
      // Attach toolbar events
      toolbar.querySelector('.katex-edit').onclick = (e) => {
        e.stopPropagation();
        const initialLatex = span.getAttribute('data-latex') || '';
        openKatexModal({
          initialLatex,
          initialClasses: [],
          onInsert: ({ latex }) => {
            span.setAttribute('data-latex', latex);
            renderKatexInEditor(editor);
          },
          onCancel: () => {}
        });
      };
      toolbar.querySelector('.katex-delete').onclick = (e) => {
        e.stopPropagation();
        span.remove();
      };
      // Return a marker for later replacement
      const marker = `[[KATEX-${Math.random().toString(36).substr(2, 8)}]]`;
      autoRenderKatexInEditor._markers = autoRenderKatexInEditor._markers || {};
      autoRenderKatexInEditor._markers[marker] = span.outerHTML;
      return marker;
    });
    // If no markers, skip
    if (!text.match(/\[\[KATEX-[a-z0-9]+\]\]/)) return;
    // Replace the text node with a fragment
    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    const markerRegex = /\[\[KATEX-[a-z0-9]+\]\]/g;
    let match;
    while ((match = markerRegex.exec(text)) !== null) {
      const before = text.slice(lastIdx, match.index);
      if (before) frag.appendChild(document.createTextNode(before));
      const marker = match[0];
      const html = autoRenderKatexInEditor._markers[marker];
      if (html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        frag.appendChild(temp.firstChild);
      }
      lastIdx = match.index + marker.length;
    }
    const after = text.slice(lastIdx);
    if (after) frag.appendChild(document.createTextNode(after));
    node.parentNode.replaceChild(frag, node);
  });
  autoRenderKatexInEditor._markers = {};
}

// 3. Exam rendering logic
function renderExam() {
  const container = document.getElementById('quiz-content');
  container.innerHTML = '';
  // Exam info bar
  if (quizState.isExam) {
    let infoBar = document.createElement('div');
    infoBar.style = 'background:var(--primary-light);color:var(--primary-dark);padding:1rem 2rem;border-radius:1.5rem;margin-bottom:2rem;font-size:1.1rem;display:flex;justify-content:space-between;align-items:center;';
    const start = new Date(quizState.examStart);
    const end = new Date(start.getTime() + quizState.examDuration * 60000);
    infoBar.innerHTML = `Exam: ${start.toLocaleDateString()} ${start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} | Duration: ${quizState.examDuration} min | Questions: ${quizState.currentQuestion + 1} / ${quizQuestions.length}`;
    container.appendChild(infoBar);
  }
  const qIndex = quizState.currentQuestion;
  if (qIndex >= quizQuestions.length) {
    // Exam complete, show post-exam page
    showExamCompletedPage();
    return;
  }
  const qid = quizQuestions[qIndex];
  getQuestionById(qid).then(q => {
    // Header
    container.innerHTML = `
      <div class="quiz-header">
        <button class="btn btn-secondary" onclick="confirmExitQuiz()">
          <img src="icons/Back.svg" alt="Back"> Back to Home
        </button>
      </div>
    `;
    // Question
    const questionBox = document.createElement('div');
    questionBox.className = 'quiz-question';
    const mathFontClass = needsMathFont(q.text) ? 'math-font' : '';
    questionBox.innerHTML = `
      <div class="question-number">Question ${qIndex + 1} of ${quizQuestions.length}</div>
      <div class="question-text ${mathFontClass}">${applyFontDelimiters(q.text)}</div>
    `;
    renderKatexInline(questionBox);
    container.append(questionBox);
    // Answer input
    let answerInput = '';
    if (q.type === 'typed') {
      answerInput = `<div class="answer-input" style="flex-direction:column;align-items:stretch;">
        <div id="typed-answer" class="form-control${needsMathFont(q.answer) ? ' math-font' : ''}" contenteditable="true" placeholder="Type your answer..." style="min-height:2.2rem;"></div>
        <button class="btn" id="submit-typed" style="margin-top:1em;align-self:flex-end;">
          <img src="icons/Check.svg" alt=""> Submit Answer
        </button>
      </div>`;
    } else {
      answerInput = `<div class="quiz-options" id="mcq-options"></div>`;
    }
    const answerDiv = document.createElement('div');
    answerDiv.innerHTML = answerInput;
    container.append(answerDiv);
    // MCQ options
    if (q.type === 'mcq') {
      const optionsDiv = answerDiv.querySelector('#mcq-options');
      q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.innerHTML = `${String.fromCharCode(65 + i)}. <span class="option-text${needsMathFont(opt) ? ' math-font' : ''}">${applyFontDelimiters(opt)}</span>`;
        btn.onclick = () => {
          showExamFeedback(q, i);
        };
        optionsDiv.appendChild(btn);
      });
    } else {
      // Typed answer
      const input = answerDiv.querySelector('#typed-answer');
      if (input) input.focus();
      answerDiv.querySelector('#submit-typed').onclick = () => {
        const ans = input ? input.innerHTML.trim() : '';
        if (!ans) {
          toast('Please enter an answer', 'error');
          if (input) input.focus();
          return;
        }
        showExamFeedback(q, ans);
      };
    }
  });
}

// Exam feedback: only show 'Your response has been recorded' and next button
function showExamFeedback(q, answer) {
  quizState.examAnswers.push({ id: q.id, answer });
  const container = document.getElementById('quiz-content');
  container.innerHTML = '';
  const feedbackBox = document.createElement('div');
  feedbackBox.className = 'feedback';
  feedbackBox.style.background = 'var(--card-bg)';
  feedbackBox.style.borderRadius = 'var(--radius-lg)';
  feedbackBox.style.margin = '2rem auto';
  feedbackBox.style.maxWidth = '600px';
  feedbackBox.style.textAlign = 'center';
  feedbackBox.style.padding = '3rem';
  feedbackBox.style.boxShadow = 'var(--card-shadow)';
  feedbackBox.innerHTML = `
    <div class="feedback-header" style="color:var(--text-secondary);font-size:1.2rem;margin-bottom:2rem;">Your response has been recorded.</div>
    <button class="btn next-btn" style="width:100%;max-width:300px;" id="next-question">Next Question</button>
  `;
  container.appendChild(feedbackBox);
  document.getElementById('next-question').onclick = () => {
    quizState.currentQuestion++;
    renderExam();
  };
}

// After exam completion, show waiting/results page
function showExamCompletedPage() {
  const container = document.getElementById('quiz-content');
  container.innerHTML = `<div class="quiz-header">
    <button class="btn btn-secondary" onclick="showPage('home');loadModulesHome();">
      <img src="icons/Back.svg" alt="Back"> Back to Home
    </button>
  </div>`;
  const div = document.createElement('div');
  div.className = 'completion-message';
  div.style.background = 'var(--card-bg)';
  div.style.padding = '3rem';
  div.style.borderRadius = 'var(--radius-lg)';
  div.style.textAlign = 'center';
  div.style.boxShadow = 'var(--card-shadow)';
  div.style.maxWidth = '800px';
  div.style.margin = '2rem auto';
  div.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: 1.5rem;">✅</div>
    <h3 style="margin-bottom: 1rem; color: var(--text-primary); font-size: 2rem;">Exam Completed</h3>
    <p style="color: var(--text-secondary); margin-bottom: 2.5rem; font-size: 1.1rem;">You have successfully completed the exam. You may go back to home or wait for the results.</p>
    <div class="completion-actions" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
      <button class="btn" id="view-scores-btn" style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; font-size: 1rem; border-radius: var(--radius);">
        <img src="icons/Score.svg" alt="" style="width: 18px; height: 18px;"> View Scores
      </button>
      <button class="btn btn-secondary" onclick="showPage('home');loadModulesHome();" style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; font-size: 1rem; border-radius: var(--radius);">
        <img src="icons/Home.svg" alt="" style="width: 18px; height: 18px;"> Back to Home
      </button>
    </div>
  `;
  container.appendChild(div);
  document.getElementById('view-scores-btn').onclick = () => {
    handleViewScores(currentModule);
  };
}

// Handle view scores logic with answer viewing window
function handleViewScores(moduleId) {
  getModuleById(moduleId).then(m => {
    const now = new Date();
    const examStart = new Date(m.examDate + 'T' + m.examTime);
    const examEnd = new Date(examStart.getTime() + m.examDuration * 60000);
    const viewWindowEnd = new Date(examEnd.getTime() + m.examDuration * 60000 / 2);
    
    if (now < examEnd) {
      // Calculate time until scores are available
      const timeUntilScores = examEnd - now;
      const hours = Math.floor(timeUntilScores / (1000 * 60 * 60));
      const minutes = Math.floor((timeUntilScores % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeMessage = '';
      if (hours > 0) {
        timeMessage = `${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        timeMessage = `${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
      
      toast(`Scores will be available in ${timeMessage}.`, 'info');
      return;
    }
    
    if (now > viewWindowEnd) {
      toast('The answer viewing window has expired.', 'error');
      // Hide module from home and lock in manage
      hideExamModuleFromHome(moduleId);
      lockExamModuleInManage(moduleId);
      showPage('home');
      loadModulesHome();
      return;
    }
    
    showExamSummary();
  });
}

// Hide module from home after answer viewing window
function hideExamModuleFromHome(moduleId) {
  // Mark module as hidden in DB
  getModuleById(moduleId).then(m => {
    m.hidden = true;
    const tx = db.transaction(STORE_M, 'readwrite');
    tx.objectStore(STORE_M).put(m);
  });
}
// Lock and mark as completed in manage page
function lockExamModuleInManage(moduleId) {
  getModuleById(moduleId).then(m => {
    m.locked = true;
    m.examCompleted = true;
    const tx = db.transaction(STORE_M, 'readwrite');
    tx.objectStore(STORE_M).put(m);
  });
}
// Update loadModulesHome to hide modules with m.hidden === true
// Update loadModulesManage to show 'Exam completed' and lock for such modules
// ... existing code ...

// Timer logic for exam
function startExamTimer() {
  if (!quizState.isExam) return;
  let timerDiv = document.getElementById('exam-timer');
  if (!timerDiv) {
    timerDiv = document.createElement('div');
    timerDiv.id = 'exam-timer';
    timerDiv.style = 'position:fixed;top:80px;right:40px;z-index:1000;background:var(--primary);color:#fff;padding:1rem 2rem;border-radius:2rem;font-size:1.3rem;font-weight:600;box-shadow:0 2px 8px rgba(30,64,175,0.10);';
    document.body.appendChild(timerDiv);
  }
  function updateTimer() {
    const start = new Date(quizState.examStart);
    const now = new Date();
    const end = new Date(start.getTime() + quizState.examDuration * 60000);
    let msLeft = end - now;
    if (msLeft < 0) msLeft = 0;
    const min = Math.floor(msLeft / 60000);
    const sec = Math.floor((msLeft % 60000) / 1000);
    timerDiv.innerHTML = `Time Left: ${min}:${sec.toString().padStart(2, '0')}<br>Questions: ${quizState.currentQuestion + 1} / ${quizQuestions.length}`;
    if (msLeft <= 0) {
      clearInterval(quizState.examTimer);
      timerDiv.remove();
      autoSubmitExam();
    }
  }
  updateTimer();
  quizState.examTimer = setInterval(updateTimer, 1000);
}

// Auto-submit exam functions
function autoSubmitExam() {
  if (!quizState || !quizState.isExam) return;
  
  // Mark exam as completed
  getModuleById(quizState.moduleId).then(m => {
    m.examCompleted = true;
    const tx = db.transaction(STORE_M, 'readwrite');
    tx.objectStore(STORE_M).put(m);
  });
  
  // Clear timer
  if (quizState.examTimer) {
    clearInterval(quizState.examTimer);
    quizState.examTimer = null;
  }
  
  // Remove timer element
  const timerDiv = document.getElementById('exam-timer');
  if (timerDiv) timerDiv.remove();
  
  // Remove event listeners
  window.removeEventListener('beforeunload', autoSubmitExamOnUnload);
  window.removeEventListener('popstate', autoSubmitExamOnUnload);
  
  // Show completion page
  showExamCompletedPage();
}

function autoSubmitExamOnUnload() {
  if (quizState && quizState.isExam) {
    autoSubmitExam();
  }
}

// Show exam summary with scores
function showExamSummary() {
  if (!quizState || !quizState.isExam) {
    toast('No exam data available', 'error');
    return;
  }
  
  const container = document.getElementById('quiz-content');
  container.innerHTML = `
    <div class="quiz-header">
      <button class="btn btn-secondary" onclick="showPage('home');loadModulesHome();">
        <img src="icons/Back.svg" alt="Back"> Back to Home
      </button>
    </div>
    <div class="completion-message" style="background: var(--card-bg); padding: 3rem; border-radius: var(--radius-lg); text-align: center; box-shadow: var(--card-shadow); max-width: 800px; margin: 2rem auto;">
      <div style="font-size: 3rem; margin-bottom: 1.5rem;">📊</div>
      <h3 style="margin-bottom: 1rem; color: var(--text-primary); font-size: 2rem;">Exam Results</h3>
      <p style="color: var(--text-secondary); margin-bottom: 2.5rem; font-size: 1.1rem;">Your exam has been completed and responses recorded.</p>
      <div class="completion-actions" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <button class="btn" onclick="showPage('home');loadModulesHome();" style="display: flex; align-items: center; gap: 0.5rem; padding: 1rem 2rem; font-size: 1rem; border-radius: var(--radius);">
          <img src="icons/Home.svg" alt="" style="width: 18px; height: 18px;"> Back to Home
        </button>
      </div>
    </div>
  `;
}
