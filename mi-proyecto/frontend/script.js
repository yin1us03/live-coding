'use strict';

// ══════════════════════════════════════════════════════════════════════════════
// script.js — Lógica exclusiva de index.html
//
// FLUJO:
//   1. Inicio     → página pública, mensajes en solo lectura
//   2. Registro   → formulario de alta. Al completarse redirige a login.
//   3. Login      → al autenticarse redirige a salas.html
// ══════════════════════════════════════════════════════════════════════════════

// ── Navegación entre pantallas ─────────────────────────────────────────────
function mostrarPantalla(pantalla) {
    ['inicio', 'login', 'registro'].forEach(id => {
        const el = document.getElementById(`pantalla-${id}`);
        if (el) el.style.display = 'none';
    });
    const destino = document.getElementById(`pantalla-${pantalla}`);
    if (destino) destino.style.display = 'block';
}

// ── Arranque ───────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    // Si el usuario ya tiene sesión activa → redirigir a salas
    iniciarSesionGuardada(
        (usuario) => {
            renderizarNavbarInicio(usuario);
            mostrarAviso(`Bienvenido de nuevo, ${usuario.nombre}. Redirigiendo...`, 'success');
            setTimeout(() => { location.href = 'salas.html'; }, 1200);
        },
        () => {
            // Sin sesión: mostrar pantalla de inicio normal
            renderizarNavbarInicio(null);
            mostrarPantalla('inicio');
            cargarMensajesPublicos();
        }
    );

    inicializarValidacionesRegistro();
});

// ── Navbar adaptada para index.html ───────────────────────────────────────
function renderizarNavbarInicio(usuario) {
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
        if (modBtn && (usuario.rol === 'moderador' || usuario.rol === 'admin'))
            modBtn.style.display = 'inline-block';
    } else {
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (perfilBtn) perfilBtn.style.display = 'none';
        if (salasLink) salasLink.style.display = 'none';
        if (perfilLink) perfilLink.style.display = 'none';
        if (modBtn) modBtn.style.display = 'none';
    }
}

// ── Mensajes públicos (solo lectura) ───────────────────────────────────────
async function cargarMensajesPublicos() {
    const contenedor = document.getElementById('contenedor-mensajes-publicos');
    if (!contenedor) return;

    try {
        // Intentar obtener mensajes del backend
        const response = await apiFetch('/mensajes?limite=8');
        
        if (response.ok) {
            const data = await response.json();
            renderizarMensajes(data.mensajes, contenedor);
        } else {
            // Fallback a datos mock
            renderizarMensajesMock(contenedor);
        }
    } catch (error) {
        // Sin conexión: usar datos mock
        console.log('Usando datos mock para mensajes públicos');
        renderizarMensajesMock(contenedor);
    }
}

function renderizarMensajes(mensajes, contenedor) {
    contenedor.innerHTML = '';
    
    if (!mensajes || mensajes.length === 0) {
        contenedor.innerHTML = '<p class="text-small" style="padding:20px;text-align:center">No hay mensajes aún. ¡Sé el primero!</p>';
        return;
    }

    mensajes.forEach(m => {
        const article = document.createElement('article');
        article.className = 'post-card';
        article.style.cursor = 'default';

        const header = document.createElement('div');
        header.className = 'post-header';

        const av = document.createElement('div');
        av.className = 'avatar avatar-sm';
        av.textContent = (m.autor || '?')[0].toUpperCase();

        const autor = document.createElement('strong');
        autor.textContent = `@${m.autor}`;

        const sala = document.createElement('span');
        sala.style.cssText = 'font-size:9px; background:var(--win-gray); padding:1px 5px; border:1px solid var(--win-bd)';
        sala.textContent = `${m.sala_icono || '💬'} ${m.sala_nombre || 'General'}`;

        const fecha = document.createElement('span');
        fecha.className = 'fecha';
        fecha.textContent = formatearFecha(m.fecha);

        header.append(av, autor, sala, fecha);

        const p = document.createElement('p');
        p.className = 'post-content';
        p.textContent = truncar(m.contenido, 120);

        article.append(header, p);
        contenedor.appendChild(article);
    });
}

function renderizarMensajesMock(contenedor) {
    // Usar datos mock como fallback
    const mensajes = [];
    MOCK.hilos.forEach(hilo => {
        const sala = MOCK.salas.find(s => s.id === hilo.salaId);
        mensajes.push({
            autor: hilo.autor,
            fecha: hilo.fecha,
            contenido: hilo.contenido,
            sala_nombre: sala ? sala.nombre : '?',
            sala_icono: sala ? sala.icono : '💬',
        });
        hilo.respuestas.forEach(r => {
            mensajes.push({
                autor: r.autor,
                fecha: r.fecha,
                contenido: r.contenido,
                sala_nombre: sala ? sala.nombre : '?',
                sala_icono: sala ? sala.icono : '💬',
            });
        });
    });

    mensajes
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 8)
        .forEach(m => {
            const article = document.createElement('article');
            article.className = 'post-card';
            article.style.cursor = 'default';

            const header = document.createElement('div');
            header.className = 'post-header';

            const av = document.createElement('div');
            av.className = 'avatar avatar-sm';
            av.textContent = m.autor[0].toUpperCase();

            const autor = document.createElement('strong');
            autor.textContent = `@${m.autor}`;

            const sala = document.createElement('span');
            sala.style.cssText = 'font-size:9px; background:var(--win-gray); padding:1px 5px; border:1px solid var(--win-bd)';
            sala.textContent = `${m.sala_icono} ${m.sala_nombre}`;

            const fecha = document.createElement('span');
            fecha.className = 'fecha';
            fecha.textContent = formatearFecha(m.fecha);

            header.append(av, autor, sala, fecha);

            const p = document.createElement('p');
            p.className = 'post-content';
            p.textContent = truncar(m.contenido, 120);

            article.append(header, p);
            contenedor.appendChild(article);
        });
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Validaciones frontend
    if (!validarEmail(email)) {
        mostrarAviso('Formato de email no válido.', 'error');
        return;
    }
    if (!password) {
        mostrarAviso('Introduce tu contraseña.', 'error');
        return;
    }

    const btnSubmit = e.target.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Conectando...';

    try {
        const res = await apiFetch('/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
            const data = await res.json();
            ZCSession.usuario = data.usuario;
            mostrarAviso(`Bienvenido, ${data.usuario.nombre}. Accediendo...`, 'success');
            setTimeout(() => { location.href = 'salas.html'; }, 900);
        } else {
            const error = await res.json().catch(() => ({}));
            mostrarAviso(error.error || 'Credenciales incorrectas.', 'error');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Entrar al Sistema';
        }
    } catch (error) {
        mostrarAviso('No se puede conectar con el servidor.', 'error');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Entrar al Sistema';
    }
});

// ── REGISTRO ───────────────────────────────────────────────────────────────
document.getElementById('form-registro').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Honeypot: si el campo oculto tiene valor, es un bot
    if (document.getElementById('hp_field').value !== '') return;

    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;

    // Validaciones en orden
    if (!validarEmail(email)) {
        mostrarAviso('Formato de email no válido.', 'error');
        return;
    }
    const { score } = calcularFortaleza(password);
    if (score < 2) {
        mostrarAviso('Contraseña demasiado débil. Añade mayúsculas, números o símbolos.', 'error');
        return;
    }
    if (password !== confirm) {
        mostrarAviso('Las contraseñas no coinciden.', 'error');
        return;
    }

    const btnSubmit = e.target.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Registrando...';

    try {
        const res = await apiFetch('/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
            mostrarAviso('¡Cuenta creada! Ahora inicia sesión.', 'success');
            setTimeout(() => mostrarPantalla('login'), 1200);
        } else {
            const data = await res.json().catch(() => ({}));
            mostrarAviso(data.error || 'No se pudo completar el registro.', 'error');
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Registrar';
        }
    } catch (error) {
        mostrarAviso('No se puede conectar con el servidor.', 'error');
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Registrar';
    }
});

// ── Validaciones en tiempo real del registro ────────────────────────────────
function inicializarValidacionesRegistro() {
    const emailInput = document.getElementById('reg-email');
    const passInput = document.getElementById('reg-password');
    const confirmInput = document.getElementById('reg-password-confirm');
    const strengthBar = document.getElementById('strength-bar');
    const passHint = document.getElementById('pass-hint');
    const matchHint = document.getElementById('match-hint');
    const emailHint = document.getElementById('email-hint');

    if (!emailInput) return;

    // Email
    emailInput.addEventListener('input', () => {
        const ok = validarEmail(emailInput.value.trim());
        const hayValor = emailInput.value.length > 0;
        emailInput.classList.toggle('valid', ok);
        emailInput.classList.toggle('invalid', !ok && hayValor);
        if (emailHint) {
            emailHint.textContent = ok ? '✅ Email válido' : (hayValor ? '❌ Formato no válido' : '');
            emailHint.className = `input-hint ${ok ? 'hint-success' : 'hint-error'}`;
        }
    });

    // Contraseña + barra de fortaleza
    passInput.addEventListener('input', () => {
        const { score } = calcularFortaleza(passInput.value);
        const niveles = [
            { label: 'Vacío', clase: '', width: '0%' },
            { label: 'Muy Débil 🔴', clase: 'weak', width: '25%' },
            { label: 'Aceptable 🟡', clase: 'medium', width: '50%' },
            { label: 'Fuerte 🟢', clase: 'strong', width: '75%' },
            { label: 'Futurista 🌐', clase: 'ultra', width: '100%' },
        ];
        const nivel = passInput.value.length === 0 ? niveles[0] : (niveles[score] || niveles[score - 1]);
        strengthBar.className = `strength-bar ${nivel.clase}`;
        strengthBar.style.width = nivel.width;
        passHint.textContent = `Nivel de seguridad: ${nivel.label}`;

        _verificarCoincidencia(passInput, confirmInput, matchHint);
    });

    // Confirmar contraseña
    confirmInput.addEventListener('input', () => {
        _verificarCoincidencia(passInput, confirmInput, matchHint);
    });
}

function _verificarCoincidencia(passInput, confirmInput, matchHint) {
    if (!confirmInput.value) return;
    const ok = confirmInput.value === passInput.value;
    confirmInput.classList.toggle('valid', ok);
    confirmInput.classList.toggle('invalid', !ok);
    matchHint.textContent = ok ? '✅ Las contraseñas coinciden' : '❌ No coinciden';
    matchHint.className = `input-hint ${ok ? 'hint-success' : 'hint-error'}`;
}