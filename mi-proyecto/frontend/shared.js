'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// shared.js — Utilidades comunes para ZonaChat.net
// ══════════════════════════════════════════════════════════════════════════════

// Configuración de API - apunta al backend Flask
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : `${window.location.protocol}//${window.location.hostname}:3000/api`;

// Sesión global
window.ZCSession = window.ZCSession || { usuario: null };

// ══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE API
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Realiza una petición a la API con manejo automático de errores
 * @param {string} endpoint - Endpoint de la API (ej: '/login')
 * @param {object} options - Opciones de fetch
 * @returns {Promise<Response>}
 */
async function apiFetch(endpoint, options = {}) {
    const defaultOptions = {
        credentials: 'include', // Importante para cookies HttpOnly
        headers: {
            'Content-Type': 'application/json',
        },
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Si hay body y es objeto, convertir a JSON
    if (finalOptions.body && typeof finalOptions.body === 'object') {
        finalOptions.body = JSON.stringify(finalOptions.body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, finalOptions);
        return response;
    } catch (error) {
        console.error('Error de conexión:', error);
        throw error;
    }
}

/**
 * Obtiene datos de la API y parsea JSON
 * @param {string} endpoint - Endpoint de la API
 * @param {object} options - Opciones de fetch
 * @returns {Promise<object>}
 */
async function apiGet(endpoint) {
    const response = await apiFetch(endpoint);
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Error de conexión' }));
        throw new Error(error.error || 'Error desconocido');
    }
    return response.json();
}

/**
 * Envía datos POST a la API
 * @param {string} endpoint - Endpoint de la API
 * @param {object} data - Datos a enviar
 * @returns {Promise<object>}
 */
async function apiPost(endpoint, data) {
    const response = await apiFetch(endpoint, {
        method: 'POST',
        body: data,
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Error en la petición');
    }
    return result;
}

/**
 * Envía datos PATCH a la API
 * @param {string} endpoint - Endpoint de la API
 * @param {object} data - Datos a enviar
 * @returns {Promise<object>}
 */
async function apiPatch(endpoint, data) {
    const response = await apiFetch(endpoint, {
        method: 'PATCH',
        body: data,
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Error en la petición');
    }
    return result;
}

/**
 * Envía datos DELETE a la API
 * @param {string} endpoint - Endpoint de la API
 * @returns {Promise<object>}
 */
async function apiDelete(endpoint) {
    const response = await apiFetch(endpoint, {
        method: 'DELETE',
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Error en la petición');
    }
    return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// GESTIÓN DE SESIÓN
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Verifica si hay una sesión activa y llama al callback correspondiente
 * @param {function} cbOk - Callback si hay sesión
 * @param {function} cbAnon - Callback si no hay sesión
 */
async function iniciarSesionGuardada(cbOk, cbAnon) {
    try {
        const response = await apiFetch('/session');
        const data = await response.json();

        if (data.autenticado && data.usuario) {
            ZCSession.usuario = data.usuario;
            cbOk && cbOk(data.usuario);
        } else {
            ZCSession.usuario = null;
            cbAnon && cbAnon();
        }
    } catch (error) {
        console.log('Sin conexión al backend, usando modo offline');
        ZCSession.usuario = null;
        cbAnon && cbAnon();
    }
}

/**
 * Cierra la sesión del usuario
 */
async function cerrarSesion() {
    try {
        await apiPost('/logout', {});
    } catch (error) {
        console.log('Error al cerrar sesión en backend');
    }
    ZCSession.usuario = null;
    window.location.href = 'index.html';
}

// ══════════════════════════════════════════════════════════════════════════════
// VALIDACIONES
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean}
 */
function validarEmail(email) {
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(email);
}

/**
 * Calcula la fortaleza de una contraseña
 * @param {string} password - Contraseña a evaluar
 * @returns {object} - {score: number, max: number}
 */
function calcularFortaleza(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return { score: Math.min(score, 4), max: 4 };
}

/**
 * Valida nombre de usuario
 * @param {string} nombre - Nombre a validar
 * @returns {object} - {valid: boolean, errors: string[]}
 */
function validarNombre(nombre) {
    const errors = [];
    if (nombre.length < 3) errors.push('Mínimo 3 caracteres');
    if (nombre.length > 30) errors.push('Máximo 30 caracteres');
    if (!/^[a-zA-Z0-9_]+$/.test(nombre)) errors.push('Solo letras, números y guión bajo');
    return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// UTILIDADES DE UI
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Renderiza la navbar según el estado de autenticación
 * @param {object|null} usuario - Datos del usuario o null
 */
function renderizarNavbar(usuario) {
    const loginBtn = document.getElementById('nav-login-btn');
    const logoutBtn = document.getElementById('nav-logout-btn');
    const perfilBtn = document.getElementById('nav-perfil-btn');
    const modBtn = document.getElementById('nav-mod-btn');
    const salasLink = document.getElementById('nav-salas-link');
    const perfilLink = document.getElementById('nav-perfil-link');

    if (usuario) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        if (perfilBtn) {
            perfilBtn.style.display = 'inline-block';
            perfilBtn.textContent = `👤 ${usuario.nombre}`;
        }
        if (salasLink) salasLink.style.display = 'inline-block';
        if (perfilLink) perfilLink.style.display = 'inline-block';
        if (modBtn && (usuario.rol === 'moderador' || usuario.rol === 'admin')) {
            modBtn.style.display = 'inline-block';
        }
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (perfilBtn) perfilBtn.style.display = 'none';
        if (salasLink) salasLink.style.display = 'none';
        if (perfilLink) perfilLink.style.display = 'none';
        if (modBtn) modBtn.style.display = 'none';
    }
}

/**
 * Muestra un aviso/toast
 * @param {string} msg - Mensaje a mostrar
 * @param {string} tipo - 'success' o 'error'
 */
function mostrarAviso(msg, tipo = 'success') {
    const container = document.getElementById('zonachat-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `zonachat-toast ${tipo}`;
    toast.setAttribute('data-title', tipo === 'error' ? '⚠ ZonaChat' : 'ℹ ZonaChat');

    const body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = msg;

    toast.appendChild(body);
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 4000);
}

/**
 * Trunca un texto
 * @param {string} texto - Texto a truncar
 * @param {number} max - Longitud máxima
 * @returns {string}
 */
function truncar(texto, max = 100) {
    if (!texto) return '';
    return texto.length > max ? texto.slice(0, max) + '…' : texto;
}

/**
 * Formatea una fecha
 * @param {string} fechaStr - Fecha en formato ISO
 * @returns {string}
 */
function formatearFecha(fechaStr) {
    if (!fechaStr) return '';
    const fecha = new Date(fechaStr);
    return fecha.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ══════════════════════════════════════════════════════════════════════════════
// DATOS MOCK (para desarrollo sin backend)
// ══════════════════════════════════════════════════════════════════════════════

const MOCK = {
    salas: [
        { id: 1, nombre: 'Tecnología', descripcion: 'Debates sobre software, hardware y redes.', miembros: 234, mensajes: 1840, icono: '💻' },
        { id: 2, nombre: 'Música', descripcion: 'Comparte artistas, álbumes y conciertos.', miembros: 189, mensajes: 920, icono: '🎵' },
        { id: 3, nombre: 'Deportes', descripcion: 'Fútbol, baloncesto, motor y más.', miembros: 312, mensajes: 2300, icono: '⚽' },
        { id: 4, nombre: 'Cine & Series', descripcion: 'Reseñas, spoilers y recomendaciones.', miembros: 156, mensajes: 780, icono: '🎬' },
        { id: 5, nombre: 'Ciencia', descripcion: 'Física, biología, astronomía y curiosidades.', miembros: 98, mensajes: 430, icono: '🔬' },
        { id: 6, nombre: 'Videojuegos', descripcion: 'PC, consolas, retro y novedades.', miembros: 278, mensajes: 1560, icono: '🎮' },
        { id: 7, nombre: 'Fotografía', descripcion: 'Técnica, equipo y galería de imágenes.', miembros: 67, mensajes: 210, icono: '📷' },
        { id: 8, nombre: 'Programación', descripcion: 'Código, proyectos open source y tutoriales.', miembros: 445, mensajes: 3200, icono: '🖥️' },
    ],
    usuarios: [
        { id: 1, nombre: 'Alejandro_99', rol: 'moderador', estado: 'online', mensajes: 342 },
        { id: 2, nombre: 'MariaSol', rol: 'usuario', estado: 'online', mensajes: 128 },
        { id: 3, nombre: 'CodeMaster', rol: 'usuario', estado: 'offline', mensajes: 891 },
        { id: 4, nombre: 'TechWizard', rol: 'admin', estado: 'online', mensajes: 2034 },
        { id: 5, nombre: 'NightOwl', rol: 'usuario', estado: 'offline', mensajes: 56 },
    ],
    hilos: [
        {
            id: 1, salaId: 1, titulo: '¿Cuál es el mejor lenguaje para empezar en 2024?', autor: 'CodeMaster', fecha: '2024-03-10T18:30:00', vistas: 1240,
            contenido: 'Llevo tiempo queriendo aprender a programar. He oído hablar de Python y JavaScript. ¿Qué me recomendáis para principiantes?',
            respuestas: [
                { id: 11, autor: 'TechWizard', fecha: '2024-03-10T19:05:00', contenido: 'Sin duda Python. La sintaxis es limpia y hay muchos recursos gratis.', votos: 12, moderador: false },
                { id: 12, autor: 'Alejandro_99', fecha: '2024-03-10T20:15:00', contenido: 'Depende de para qué. Si quieres trabajo rápido, JavaScript está en todas partes.', votos: 8, moderador: true },
            ]
        },
        {
            id: 2, salaId: 8, titulo: 'Proyecto: foro seguro en Flask + SQLite', autor: 'Alejandro_99', fecha: '2024-03-12T10:00:00', vistas: 450,
            contenido: 'Estoy desarrollando un foro con Flask. El objetivo es autenticación segura, cookies HttpOnly y protección XSS.',
            respuestas: [
                { id: 21, autor: 'TechWizard', fecha: '2024-03-12T11:20:00', contenido: 'Muy buen enfoque. Te recomiendo Flask-Login + bcrypt.', votos: 5, moderador: false },
            ]
        },
    ],
    reportes: [
        { id: 1, tipo: 'mensaje', objetivo: 'NightOwl', razon: 'Spam', estado: 'pendiente', fecha: '2024-03-13T14:00:00' },
        { id: 2, tipo: 'usuario', objetivo: 'SpamBot123', razon: 'Bot / spam masivo', estado: 'resuelto', fecha: '2024-03-12T09:30:00' },
    ],
};

// ══════════════════════════════════════════════════════════════════════════════
// REDIRECCIONES DE ERROR
// ══════════════════════════════════════════════════════════════════════════════

function redirigirError(codigo) {
    location.href = `${codigo}.html`;
}

function requiereRol(...rolesPermitidos) {
    const usuario = ZCSession.usuario;
    if (!usuario) { redirigirError(403); return false; }
    if (!rolesPermitidos.includes(usuario.rol)) { redirigirError(403); return false; }
    return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// MODO OSCURO
// ══════════════════════════════════════════════════════════════════════════════

const DARK_KEY = 'zonachat_dark';

function inicializarModoOscuro() {
    const guardado = localStorage.getItem(DARK_KEY);
    const prefiereDark = guardado !== null
        ? guardado === '1'
        : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (prefiereDark) document.documentElement.classList.add('dark');
    _actualizarToggle();
}

function toggleModoOscuro() {
    const esDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem(DARK_KEY, esDark ? '1' : '0');
    _actualizarToggle();
}

function _actualizarToggle() {
    const esDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.dark-toggle').forEach(btn => {
        const icon = btn.querySelector('.toggle-icon');
        const label = btn.querySelector('.toggle-label');
        if (icon) icon.textContent = esDark ? '☀️' : '🌙';
        if (label) label.textContent = esDark ? 'Modo claro' : 'Modo oscuro';
        btn.title = esDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    });
}