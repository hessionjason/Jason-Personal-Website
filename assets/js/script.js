'use strict';

/* ============================================
   JASON HESSION XP — MAIN SCRIPT
   Boot → Login → Desktop → Windows
   ============================================ */

// ─── State ───────────────────────────────────
const state = {
    windows: {},          // { id: { el, minimized, maximized, zIndex } }
    zCounter: 100,
    focusedWindow: null,
    startMenuOpen: false,
    crtEnabled: false,
    dragState: null,
    resizeState: null,
};

const windowConfigs = {
    about:    { title: 'About Me',     icon: '👤', width: 700, height: 500 },
    resume:   { title: 'My Resume',    icon: '📄', width: 700, height: 550 },
    projects: { title: 'My Projects',  icon: '📁', width: 750, height: 520 },
    contact:  { title: 'Contact Me',   icon: '✉️', width: 650, height: 560 },
};

// ─── DOM refs ────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const bootScreen    = $('#boot-screen');
const loginScreen   = $('#login-screen');
const welcomeOvl    = $('#welcome-overlay');
const desktop       = $('#desktop');
const taskbar       = $('#taskbar');
const winContainer  = $('#windows-container');
const taskbarProgs  = $('#taskbar-programs');
const startMenu     = $('#start-menu');
const startBtn      = $('#start-button');
const trayClock     = $('#tray-clock');
const crtToggle     = $('#crt-toggle');

// ─── Boot Sequence ───────────────────────────
function startBootSequence() {
    setTimeout(() => {
        bootScreen.classList.add('fade-out');
        setTimeout(() => {
            bootScreen.style.display = 'none';
            showLoginScreen();
        }, 700);
    }, 3000);
}

function showLoginScreen() {
    loginScreen.style.display = 'flex';
    requestAnimationFrame(() => {
        loginScreen.classList.add('visible');
    });
}

// ─── Login ───────────────────────────────────
function handleLogin() {
    loginScreen.classList.add('fade-out');
    setTimeout(() => {
        loginScreen.style.display = 'none';
        showDesktop();
    }, 600);
}

function showDesktop() {
    desktop.classList.add('visible');
    taskbar.classList.add('visible');
    startClock();

    // Show welcome message
    welcomeOvl.classList.add('visible');
    setTimeout(() => {
        welcomeOvl.classList.remove('visible');
        welcomeOvl.style.display = 'none';
    }, 2800);
}

// ─── Clock ───────────────────────────────────
function startClock() {
    function update() {
        const now = new Date();
        let h = now.getHours();
        const m = String(now.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        trayClock.textContent = `${h}:${m} ${ampm}`;
    }
    update();
    setInterval(update, 15000);
}

// ─── Window Management ───────────────────────
function createWindow(id) {
    if (state.windows[id]) {
        const win = state.windows[id];
        if (win.minimized) {
            restoreWindow(id);
        }
        focusWindow(id);
        return;
    }

    const config = windowConfigs[id];
    if (!config) return;

    const tmpl = $(`#tmpl-${id}`);
    if (!tmpl) return;

    const el = document.createElement('div');
    el.className = 'app-window focused';
    el.dataset.windowId = id;

    // Position
    const offsetCount = Object.keys(state.windows).length;
    const x = Math.min(60 + offsetCount * 30, window.innerWidth - config.width - 20);
    const y = Math.min(40 + offsetCount * 30, window.innerHeight - config.height - 60);
    el.style.left = Math.max(0, x) + 'px';
    el.style.top = Math.max(0, y) + 'px';
    el.style.width = config.width + 'px';
    el.style.height = config.height + 'px';
    el.style.zIndex = ++state.zCounter;

    // Build window HTML
    el.innerHTML = `
        <div class="win-titlebar" data-drag-handle>
            <div class="win-titlebar-left">
                <span class="win-titlebar-icon">${config.icon}</span>
                <span class="win-title">${config.title}</span>
            </div>
            <div class="win-titlebar-btns">
                <button class="win-btn win-btn-min" title="Minimize" aria-label="Minimize">&#8211;</button>
                <button class="win-btn win-btn-max" title="Maximize" aria-label="Maximize">&#9633;</button>
                <button class="win-btn win-btn-close" title="Close" aria-label="Close">&#10005;</button>
            </div>
        </div>
        <div class="win-body">${tmpl.innerHTML}</div>
        <div class="win-statusbar">${config.title}</div>
        <div class="resize-handle n"></div>
        <div class="resize-handle s"></div>
        <div class="resize-handle e"></div>
        <div class="resize-handle w"></div>
        <div class="resize-handle ne"></div>
        <div class="resize-handle nw"></div>
        <div class="resize-handle se"></div>
        <div class="resize-handle sw"></div>
    `;

    winContainer.appendChild(el);

    state.windows[id] = { el, minimized: false, maximized: false, zIndex: state.zCounter };

    // Focus
    unfocusAll();
    el.classList.add('focused');
    state.focusedWindow = id;

    // Titlebar button events
    el.querySelector('.win-btn-close').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(id); });
    el.querySelector('.win-btn-min').addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(id); });
    el.querySelector('.win-btn-max').addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(id); });

    // Double-click titlebar to maximize
    el.querySelector('.win-titlebar').addEventListener('dblclick', () => toggleMaximize(id));

    // Focus on click
    el.addEventListener('mousedown', () => focusWindow(id));

    // Drag
    setupDrag(el, id);

    // Resize
    setupResize(el, id);

    // Taskbar item
    addTaskbarItem(id);

    // Init contact form if contact window
    if (id === 'contact') {
        initContactForm(el);
    }
}

function closeWindow(id) {
    const win = state.windows[id];
    if (!win) return;

    win.el.classList.add('closing');
    setTimeout(() => {
        win.el.remove();
        delete state.windows[id];
        removeTaskbarItem(id);
        if (state.focusedWindow === id) state.focusedWindow = null;
    }, 150);
}

function minimizeWindow(id) {
    const win = state.windows[id];
    if (!win) return;

    win.el.classList.add('minimizing');
    setTimeout(() => {
        win.el.style.display = 'none';
        win.el.classList.remove('minimizing');
        win.minimized = true;
        updateTaskbarItem(id);
    }, 150);
}

function restoreWindow(id) {
    const win = state.windows[id];
    if (!win) return;

    win.el.style.display = 'flex';
    win.el.classList.add('restoring');
    win.minimized = false;
    setTimeout(() => win.el.classList.remove('restoring'), 150);
    focusWindow(id);
    updateTaskbarItem(id);
}

function toggleMaximize(id) {
    const win = state.windows[id];
    if (!win) return;

    if (win.maximized) {
        win.el.classList.remove('maximized');
        win.el.style.left = win.prevRect.left + 'px';
        win.el.style.top = win.prevRect.top + 'px';
        win.el.style.width = win.prevRect.width + 'px';
        win.el.style.height = win.prevRect.height + 'px';
        win.maximized = false;
    } else {
        win.prevRect = {
            left: parseInt(win.el.style.left),
            top: parseInt(win.el.style.top),
            width: parseInt(win.el.style.width),
            height: parseInt(win.el.style.height),
        };
        win.el.classList.add('maximized');
        win.maximized = true;
    }
    focusWindow(id);
}

function focusWindow(id) {
    unfocusAll();
    const win = state.windows[id];
    if (!win) return;

    win.el.style.zIndex = ++state.zCounter;
    win.el.classList.add('focused');
    state.focusedWindow = id;
    updateAllTaskbarItems();
}

function unfocusAll() {
    Object.values(state.windows).forEach(w => w.el.classList.remove('focused'));
    state.focusedWindow = null;
}

// ─── Drag ────────────────────────────────────
function setupDrag(el, id) {
    const titlebar = el.querySelector('[data-drag-handle]');

    titlebar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.win-btn') || state.windows[id].maximized) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        state.dragState = {
            id,
            el,
            startX: e.clientX,
            startY: e.clientY,
            origLeft: rect.left,
            origTop: rect.top,
        };
        focusWindow(id);
    });
}

function handleDragMove(e) {
    if (!state.dragState) return;
    const { el, startX, startY, origLeft, origTop } = state.dragState;
    el.style.left = (origLeft + e.clientX - startX) + 'px';
    el.style.top = Math.max(0, origTop + e.clientY - startY) + 'px';
}

function handleDragEnd() {
    state.dragState = null;
}

// ─── Resize ──────────────────────────────────
function setupResize(el, id) {
    el.querySelectorAll('.resize-handle').forEach(handle => {
        handle.addEventListener('mousedown', (e) => {
            if (state.windows[id].maximized) return;
            e.preventDefault();
            e.stopPropagation();

            const rect = el.getBoundingClientRect();
            const direction = [...handle.classList].find(c => c !== 'resize-handle');
            state.resizeState = {
                id, el, direction,
                startX: e.clientX,
                startY: e.clientY,
                origLeft: rect.left,
                origTop: rect.top,
                origWidth: rect.width,
                origHeight: rect.height,
            };
            focusWindow(id);
        });
    });
}

function handleResizeMove(e) {
    if (!state.resizeState) return;
    const { el, direction, startX, startY, origLeft, origTop, origWidth, origHeight } = state.resizeState;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const minW = 320, minH = 240;

    if (direction.includes('e')) el.style.width = Math.max(minW, origWidth + dx) + 'px';
    if (direction.includes('s')) el.style.height = Math.max(minH, origHeight + dy) + 'px';
    if (direction.includes('w')) {
        const newW = Math.max(minW, origWidth - dx);
        el.style.width = newW + 'px';
        el.style.left = (origLeft + origWidth - newW) + 'px';
    }
    if (direction.includes('n')) {
        const newH = Math.max(minH, origHeight - dy);
        el.style.height = newH + 'px';
        el.style.top = Math.max(0, origTop + origHeight - newH) + 'px';
    }
}

function handleResizeEnd() {
    state.resizeState = null;
}

// ─── Taskbar Items ───────────────────────────
function addTaskbarItem(id) {
    const config = windowConfigs[id];
    const item = document.createElement('div');
    item.className = 'taskbar-item active';
    item.dataset.taskId = id;
    item.innerHTML = `<span class="taskbar-item-icon">${config.icon}</span><span>${config.title}</span>`;
    item.addEventListener('click', () => {
        const win = state.windows[id];
        if (!win) return;
        if (win.minimized) {
            restoreWindow(id);
        } else if (state.focusedWindow === id) {
            minimizeWindow(id);
        } else {
            focusWindow(id);
        }
    });
    taskbarProgs.appendChild(item);
}

function removeTaskbarItem(id) {
    const item = taskbarProgs.querySelector(`[data-task-id="${id}"]`);
    if (item) item.remove();
}

function updateTaskbarItem(id) {
    updateAllTaskbarItems();
}

function updateAllTaskbarItems() {
    taskbarProgs.querySelectorAll('.taskbar-item').forEach(item => {
        const tid = item.dataset.taskId;
        item.classList.toggle('active', state.focusedWindow === tid);
    });
}

// ─── Start Menu ──────────────────────────────
function toggleStartMenu() {
    state.startMenuOpen = !state.startMenuOpen;
    startMenu.classList.toggle('hidden', !state.startMenuOpen);
    startBtn.classList.toggle('active', state.startMenuOpen);
}

function closeStartMenu() {
    if (!state.startMenuOpen) return;
    state.startMenuOpen = false;
    startMenu.classList.add('hidden');
    startBtn.classList.remove('active');
}

// ─── CRT Toggle ──────────────────────────────
function toggleCRT() {
    state.crtEnabled = !state.crtEnabled;
    document.body.classList.toggle('crt-active', state.crtEnabled);

    // Animate scanline
    if (state.crtEnabled) {
        animateScanline();
    }
}

function animateScanline() {
    const scanline = $('#crt-scanline');
    if (!scanline || !state.crtEnabled) return;

    let pos = -2;
    function step() {
        if (!state.crtEnabled) return;
        pos += 0.5;
        if (pos > window.innerHeight) pos = -2;
        scanline.style.top = pos + 'px';
        requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// ─── Contact Form ────────────────────────────
function initContactForm(windowEl) {
    const form = windowEl.querySelector('#contact-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(form);

        fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: { 'Accept': 'application/json' }
        }).then(response => {
            if (response.ok) {
                form.style.display = 'none';
                windowEl.querySelector('#form-response').classList.remove('hidden');
            } else {
                alert('There was an error submitting your message.');
            }
        }).catch(() => {
            alert('There was an error submitting your message.');
        });
    });
}

// ─── Restart ─────────────────────────────────
function restart() {
    closeStartMenu();
    // Close all windows
    Object.keys(state.windows).forEach(closeWindow);
    // Hide desktop
    desktop.classList.remove('visible');
    taskbar.classList.remove('visible');

    // Show boot
    bootScreen.style.display = 'flex';
    bootScreen.classList.remove('fade-out');
    bootScreen.querySelector('.boot-content').style.animation = 'none';
    requestAnimationFrame(() => {
        bootScreen.querySelector('.boot-content').style.animation = '';
        startBootSequence();
    });
}

// ─── Event Listeners ─────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    // Boot
    startBootSequence();

    // Login click
    $('#login-btn').addEventListener('click', handleLogin);
    $('#login-btn').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') handleLogin();
    });

    // Desktop icon double-click
    $$('.desktop-icon').forEach(icon => {
        icon.addEventListener('dblclick', () => {
            const winId = icon.dataset.window;
            createWindow(winId);
        });
        // Mobile: single tap
        icon.addEventListener('touchend', (e) => {
            e.preventDefault();
            const winId = icon.dataset.window;
            if (icon.classList.contains('selected')) {
                createWindow(winId);
                icon.classList.remove('selected');
            } else {
                $$('.desktop-icon').forEach(i => i.classList.remove('selected'));
                icon.classList.add('selected');
            }
        });
        // Single click selects
        icon.addEventListener('click', () => {
            $$('.desktop-icon').forEach(i => i.classList.remove('selected'));
            icon.classList.add('selected');
        });
    });

    // Start menu
    startBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleStartMenu();
    });

    // Start menu items
    $$('.sm-item[data-window]').forEach(item => {
        item.addEventListener('click', () => {
            createWindow(item.dataset.window);
            closeStartMenu();
        });
    });

    // Restart
    $('#restart-btn').addEventListener('click', restart);

    // Close start menu on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.start-menu') && !e.target.closest('.start-button')) {
            closeStartMenu();
        }
    });

    // CRT toggle
    crtToggle.addEventListener('click', toggleCRT);

    // Global mouse events for drag/resize
    document.addEventListener('mousemove', (e) => {
        handleDragMove(e);
        handleResizeMove(e);
    });
    document.addEventListener('mouseup', () => {
        handleDragEnd();
        handleResizeEnd();
    });

    // Click on desktop to deselect icons & unfocus windows
    desktop.addEventListener('click', (e) => {
        if (e.target === desktop || e.target.closest('.desktop-icons') === e.target.closest('.desktop')) {
            $$('.desktop-icon').forEach(i => i.classList.remove('selected'));
        }
    });

    // Keyboard: Escape closes start menu
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeStartMenu();
        }
    });
});
