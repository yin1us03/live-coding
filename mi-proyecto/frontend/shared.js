'use strict';
const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : 'https://tu-dominio.com/api';
window.ZCSession = window.ZCSession || { usuario: null };
async function apiFetch(endpoint, options = {}) {
    return fetch(`${API_URL}${endpoint}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
}
// getMockUsuario() solo rellena datos de UI. NUNCA simula sesión automática.
function getMockUsuario() {
    return { id: 1, nombre: 'Alejandro_99', email: 'alejandro@red.com', rol: 'moderador', avatar: null, bio: 'Usuario fundador de ZonaChat.net.', fecha_registro: '2003-04-12', mensajes_total: 342 };
}

// Sin backend disponible → siempre anónimo. Nunca auto-login con mock.
// ── Sesión mock para desarrollo (sin backend) ──────────────────────────────
// script.js escribe en sessionStorage tras un login mock exitoso.
// Se borra automáticamente al cerrar la pestaña (comportamiento correcto).
// En producción con backend real esto nunca se usa.
function _guardarSesionMock(usuario) {
    try { sessionStorage.setItem('zonachat_mock_session', JSON.stringify(usuario)); } catch {}
}
function _leerSesionMock() {
    try { const s = sessionStorage.getItem('zonachat_mock_session'); return s ? JSON.parse(s) : null; } catch { return null; }
}
function _borrarSesionMock() {
    try { sessionStorage.removeItem('zonachat_mock_session'); } catch {}
}

async function iniciarSesionGuardada(cbOk, cbAnon) {
    try {
        const res = await apiFetch('/session');
        if (res.ok) {
            const d = await res.json();
            ZCSession.usuario = d.usuario;
            cbOk && cbOk(d.usuario);
        } else {
            ZCSession.usuario = null;
            cbAnon && cbAnon();
        }
    } catch {
        // Sin backend: comprobar si hay sesión mock guardada en sessionStorage
        const mock = _leerSesionMock();
        if (mock) {
            ZCSession.usuario = mock;
            cbOk && cbOk(mock);
        } else {
            ZCSession.usuario = null;
            cbAnon && cbAnon();
        }
    }
}
async function cerrarSesion() { try { await apiFetch('/logout', { method: 'POST' }); } catch {} ZCSession.usuario = null; _borrarSesionMock(); window.location.href = 'index.html'; }
function validarEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
function calcularFortaleza(p) { let s=0; if(p.length>=8)s++; if(/[A-Z]/.test(p))s++; if(/[0-9]/.test(p))s++; if(/[^A-Za-z0-9]/.test(p))s++; return {score:s,max:4}; }
function renderizarNavbar(usuario) {
    const lb=document.getElementById('nav-login-btn'), lo=document.getElementById('nav-logout-btn'), pb=document.getElementById('nav-perfil-btn'), mb=document.getElementById('nav-mod-btn');
    if (usuario) {
        if(lb) lb.style.display='none'; if(lo) lo.style.display='inline-block';
        if(pb){ pb.style.display='inline-block'; pb.textContent=`👤 ${usuario.nombre}`; }
        if(mb && (usuario.rol==='moderador'||usuario.rol==='admin')) mb.style.display='inline-block';
    } else {
        if(lb) lb.style.display='inline-block'; if(lo) lo.style.display='none';
        if(pb) pb.style.display='none'; if(mb) mb.style.display='none';
    }
}
function mostrarAviso(msg, tipo='success') {
    const c=document.getElementById('zonachat-toast-container'); if(!c) return;
    const t=document.createElement('div'); t.className=`zonachat-toast ${tipo}`; t.setAttribute('data-title', tipo==='error'?'⚠ ZonaChat':'ℹ ZonaChat');
    const b=document.createElement('div'); b.className='toast-body'; b.textContent=msg;
    t.appendChild(b); c.appendChild(t);
    setTimeout(()=>{ t.classList.add('fade-out'); t.addEventListener('animationend',()=>t.remove(),{once:true}); }, 4000);
}
function truncar(t, max=100) { return !t?'': t.length>max? t.slice(0,max)+'…':t; }
function formatearFecha(s) { if(!s) return ''; const d=new Date(s); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}); }
const MOCK = {
    salas: [
        {id:1,nombre:'Tecnología',   descripcion:'Debates sobre software, hardware y redes.',       miembros:234,mensajes:1840,icono:'💻'},
        {id:2,nombre:'Música',        descripcion:'Comparte artistas, álbumes y conciertos.',        miembros:189,mensajes:920, icono:'🎵'},
        {id:3,nombre:'Deportes',      descripcion:'Fútbol, baloncesto, motor y más.',                miembros:312,mensajes:2300,icono:'⚽'},
        {id:4,nombre:'Cine & Series', descripcion:'Reseñas, spoilers y recomendaciones.',            miembros:156,mensajes:780, icono:'🎬'},
        {id:5,nombre:'Ciencia',       descripcion:'Física, biología, astronomía y curiosidades.',    miembros:98, mensajes:430, icono:'🔬'},
        {id:6,nombre:'Videojuegos',   descripcion:'PC, consolas, retro y novedades.',                miembros:278,mensajes:1560,icono:'🎮'},
        {id:7,nombre:'Fotografía',    descripcion:'Técnica, equipo y galería de imágenes.',          miembros:67, mensajes:210, icono:'📷'},
        {id:8,nombre:'Programación',  descripcion:'Código, proyectos open source y tutoriales.',     miembros:445,mensajes:3200,icono:'🖥️'},
    ],
    usuarios: [
        {id:1,nombre:'Alejandro_99',rol:'moderador',estado:'online', mensajes:342},
        {id:2,nombre:'MariaSol',    rol:'usuario',  estado:'online', mensajes:128},
        {id:3,nombre:'CodeMaster',  rol:'usuario',  estado:'offline',mensajes:891},
        {id:4,nombre:'TechWizard',  rol:'admin',    estado:'online', mensajes:2034},
        {id:5,nombre:'NightOwl',    rol:'usuario',  estado:'offline',mensajes:56},
    ],
    hilos: [
        {id:1,salaId:1,titulo:'¿Cuál es el mejor lenguaje para empezar en 2004?',autor:'CodeMaster',fecha:'2004-03-10T18:30:00',vistas:1240,
         contenido:'Llevo tiempo queriendo aprender a programar. He oído hablar de Java, C++ y ese nuevo Python. ¿Qué me recomendáis para principiantes?',
         respuestas:[
            {id:11,autor:'TechWizard',  fecha:'2004-03-10T19:05:00',contenido:'Sin duda Python. La sintaxis es limpia y hay muchos recursos gratis. Empecé hace dos años y ya tengo varios proyectos.',votos:12,moderador:false},
            {id:12,autor:'Alejandro_99',fecha:'2004-03-10T20:15:00',contenido:'Depende de para qué. Si quieres trabajo rápido, Java está en todas las empresas. Si es por hobby, Python o PHP para webs.',votos:8,moderador:true},
            {id:13,autor:'MariaSol',    fecha:'2004-03-11T09:00:00',contenido:'Yo empecé con Visual Basic. Fue amigable para entender conceptos antes de pasar a C#.',votos:3,moderador:false},
         ]},
        {id:2,salaId:8,titulo:'Proyecto: foro seguro en Flask + SQLite',autor:'Alejandro_99',fecha:'2004-03-12T10:00:00',vistas:450,
         contenido:'Estoy desarrollando un foro con Flask. El objetivo es autenticación segura, cookies HttpOnly y protección XSS desde el principio.',
         respuestas:[
            {id:21,autor:'TechWizard',fecha:'2004-03-12T11:20:00',contenido:'Muy buen enfoque. ¿Usas Flask-Login o gestionas sesiones manualmente? Te recomiendo Flask-Login + bcrypt.',votos:5,moderador:false},
         ]},
        {id:3,salaId:1,titulo:'Windows XP vs Linux: ¿Cuál usáis en casa?',autor:'MariaSol',fecha:'2004-03-11T12:00:00',vistas:890,
         contenido:'Con el nuevo XP funcionando muy bien me pregunto si merece la pena pasarse a Linux. ¿Alguien tiene experiencia con ambos?',
         respuestas:[
            {id:31,autor:'CodeMaster',fecha:'2004-03-11T13:00:00',contenido:'XP para juegos, Linux para todo lo demás. Dual boot es la solución.',votos:7,moderador:false},
         ]},
    ],
    reportes: [
        {id:1,tipo:'mensaje', objetivo:'NightOwl',   razon:'Spam',                estado:'pendiente',fecha:'2004-03-13T14:00:00'},
        {id:2,tipo:'usuario', objetivo:'SpamBot123', razon:'Bot / spam masivo',   estado:'resuelto', fecha:'2004-03-12T09:30:00'},
        {id:3,tipo:'mensaje', objetivo:'Trollface',  razon:'Contenido inapropiado',estado:'pendiente',fecha:'2004-03-13T16:45:00'},
        {id:4,tipo:'usuario', objetivo:'FloodUser',  razon:'Flood de mensajes',   estado:'pendiente',fecha:'2004-03-14T08:10:00'},
    ],
};

// ── Redirección a páginas de error ────────────────────────────────────────
// Usar estas funciones en cualquier página cuando detectes un acceso no permitido.
// Ejemplos:
//   redirigirError(403)  → cuando el usuario no tiene rol suficiente
//   redirigirError(404)  → cuando un recurso no existe
function redirigirError(codigo) {
    location.href = `${codigo}.html`;
}

// Comprobar acceso por rol antes de mostrar una sección.
// Uso: if (!requiereRol('moderador')) return;
function requiereRol(...rolesPermitidos) {
    const usuario = ZCSession.usuario;
    if (!usuario) { redirigirError(403); return false; }
    if (!rolesPermitidos.includes(usuario.rol)) { redirigirError(403); return false; }
    return true;
}

// ── Modo oscuro ───────────────────────────────────────────────────────────────
// Guarda la preferencia en localStorage para que persista entre sesiones.
// Se aplica en <html> con la clase 'dark'.

const DARK_KEY = 'zonachat_dark';

function inicializarModoOscuro() {
    // Aplicar preferencia guardada (o preferencia del sistema si no hay ninguna)
    const guardado = localStorage.getItem(DARK_KEY);
    const prefiereDark = guardado !== null
        ? guardado === '1'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;

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
        btn.querySelector('.toggle-icon').textContent = esDark ? '☀️' : '🌙';
        btn.querySelector('.toggle-label').textContent = esDark ? 'Modo claro' : 'Modo oscuro';
        btn.title = esDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
    });
}
