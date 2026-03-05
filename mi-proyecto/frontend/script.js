// URLs de nuestra API (Recuerda: docker-compose expone el backend en el puerto 3000)
const API_URL = 'http://localhost:3000/api';

// Función para cambiar entre pantallas (Inicio, Login, Registro)
function mostrarPantalla(pantalla) {
    document.getElementById('pantalla-inicio').style.display = 'none';
    document.getElementById('pantalla-login').style.display = 'none';
    document.getElementById('pantalla-registro').style.display = 'none';

    document.getElementById(`pantalla-${pantalla}`).style.display = 'block';
}

// LÓGICA DE LOGIN
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se recargue

    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    console.log("Intentando loguear con:", email);

    // Aquí haremos el fetch() al backend más adelante.
    // Por ahora, vamos a simular que el login fue un éxito.
    
    // Simulación de éxito:
    alert("¡Login simulado con éxito!");
    document.getElementById('nav-login-btn').style.display = 'none';
    document.getElementById('nav-logout-btn').style.display = 'block';
    
    // Volvemos a la pantalla de inicio
    mostrarPantalla('inicio');
});

// LÓGICA DE REGISTRO
document.getElementById('form-registro').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-password-confirm').value;

    // 🚨 SURVIVAL CHECKLIST (Validación en Frontend):
    if (password !== confirmPassword) {
        alert("Las contraseñas no coinciden.");
        return; // Cortamos la ejecución aquí
    }

    if (password.length < 6) {
        alert("La contraseña debe tener al menos 6 caracteres.");
        return;
    }

    console.log("Intentando registrar:", email);
    
    // Simulación de éxito:
    alert("¡Registro simulado! Ahora inicia sesión.");
    mostrarPantalla('login');
});

// Función para cerrar sesión
function cerrarSesion() {
    // Aquí borraremos el token/sesión más adelante
    document.getElementById('nav-login-btn').style.display = 'block';
    document.getElementById('nav-logout-btn').style.display = 'none';
    alert("Sesión cerrada");
    mostrarPantalla('inicio');
}

// Clave para guardar el estado en el navegador
const SESSION_KEY = 'aero_session_token';

// 1. COMPROBACIÓN INICIAL AL CARGAR LA PÁGINA
window.onload = () => {
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
        aplicarEstadoLogueado(JSON.parse(session));
    } else {
        mostrarPantalla('inicio');
    }
};

function aplicarEstadoLogueado(usuario) {
    document.getElementById('nav-login-btn').style.display = 'none';
    document.getElementById('nav-logout-btn').style.display = 'block';
    // Podrías mostrar un mensaje de "Bienvenido, [Usuario]" con estilo glossy
    mostrarPantalla('inicio');
}

function validarFormulario(email, password) {
    // 🚨 SEGURIDAD: Prevenir inyecciones básicas y errores de formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(email)) {
        alert("Formato de Email no reconocido por el sistema.");
        return false;
    }
    
    if (password.length < 8) {
        alert("Seguridad insuficiente: La contraseña requiere mínimo 8 caracteres.");
        return false;
    }
    
    return true;
}

function renderizarMensaje(autor, texto) {
    const contenedor = document.getElementById('contenedor-mensajes');
    
    const article = document.createElement('article');
    article.className = 'post-card'; // Tu estilo Aero

    const header = document.createElement('div');
    header.className = 'post-header';
    
    const strong = document.createElement('strong');
    strong.textContent = `@${autor}`; // ✅ SEGURO: escapa HTML automáticamente
    
    const p = document.createElement('p');
    p.textContent = texto; // ✅ SEGURO: si el usuario escribe <script>, se verá como texto plano

    header.appendChild(strong);
    article.appendChild(header);
    article.appendChild(p);
    contenedor.prepend(article);
}


function publicarMensaje() {
    const session = localStorage.getItem(SESSION_KEY);
    
    if (!session) {
        alert("Acceso Denegado: Identificación requerida.");
        mostrarPantalla('login');
        return;
    }
    
    // Si hay sesión, procedemos con el fetch al backend...
}



/**
 * Muestra una notificación Aero al usuario.
 * @param {string} mensaje - El texto a mostrar.
 * @param {string} tipo - 'success' o 'error'.
 */
 function mostrarAviso(mensaje, tipo = 'success') {
    const container = document.getElementById('aero-toast-container');
    
    // Crear el elemento de la notificación
    const toast = document.createElement('div');
    toast.className = `aero-toast ${tipo}`;
    
    // 🚨 SEGURIDAD: Usamos textContent para evitar inyección de scripts
    toast.textContent = mensaje;
    
    container.appendChild(toast);

    // Eliminar automáticamente después de 4 segundos
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

// EJEMPLO DE USO EN VALIDACIÓN:
document.getElementById('form-login').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    
    if (!email.includes('@')) {
        mostrarAviso("⚠️ Acceso denegado: Formato de identidad no válido.", "error");
        return;
    }
    
    mostrarAviso("🌐 Conectando con la red central...", "success");
});



// --- VALIDACIÓN DE EMAIL ---
const emailInput = document.getElementById('reg-email');
emailInput.addEventListener('input', () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(emailInput.value)) {
        emailInput.classList.replace('invalid', 'valid') || emailInput.classList.add('valid');
    } else {
        emailInput.classList.replace('valid', 'invalid') || emailInput.classList.add('invalid');
    }
});

// --- VALIDACIÓN DE CONTRASEÑA ---

passInput.addEventListener('input', () => {
    const pass = passInput.value;
    
    // Criterios: Mínimo 8 caracteres y al menos un número
    const hasNumber = /\d/.test(pass);
    const isLongEnough = pass.length >= 8;

    if (hasNumber && isLongEnough) {
        passInput.classList.add('valid');
        passInput.classList.remove('invalid');
        passHint.textContent = "✅ Contraseña robusta";
        passHint.className = "input-hint hint-success";
    } else {
        passInput.classList.add('invalid');
        passInput.classList.remove('valid');
        passHint.textContent = "❌ Mínimo 8 caracteres y un número";
        passHint.className = "input-hint hint-error";
    }
    validarCoincidencia();
});

function validarCoincidencia() {
    if (confirmInput.value === passInput.value && passInput.value !== "") {
        confirmInput.classList.add('valid');
        confirmInput.classList.remove('invalid');
        matchHint.textContent = "✅ Las contraseñas coinciden";
        matchHint.className = "input-hint hint-success";
    } else {
        confirmInput.classList.add('invalid');
        confirmInput.classList.remove('valid');
        matchHint.textContent = "❌ Las contraseñas no coinciden";
        matchHint.className = "input-hint hint-error";
    }
}

confirmInput.addEventListener('input', validarCoincidencia);



const passInput = document.getElementById('reg-password');
const strengthBar = document.getElementById('strength-bar');
const passHint = document.getElementById('pass-hint');
const formRegistro = document.getElementById('form-registro');

// 1. CALCULAR FUERZA EN TIEMPO REAL
passInput.addEventListener('input', () => {
    const val = passInput.value;
    let score = 0;

    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    // Actualizar visualmente la barra
    strengthBar.className = "strength-bar"; // Reset
    if (val.length === 0) {
        strengthBar.style.width = "0%";
        passHint.textContent = "Nivel de seguridad: Vacío";
    } else if (score <= 1) {
        strengthBar.style.width = "25%";
        strengthBar.classList.add('weak');
        passHint.textContent = "Nivel: Muy Débil 🔴";
    } else if (score === 2) {
        strengthBar.style.width = "50%";
        strengthBar.classList.add('medium');
        passHint.textContent = "Nivel: Aceptable 🟡";
    } else if (score === 3) {
        strengthBar.style.width = "75%";
        strengthBar.classList.add('strong');
        passHint.textContent = "Nivel: Fuerte 🟢";
    } else {
        strengthBar.style.width = "100%";
        strengthBar.classList.add('ultra');
        passHint.textContent = "Nivel: Futurista 🌐";
    }
});

// 2. BLOQUEO TOTAL DEL FORMULARIO
formRegistro.addEventListener('submit', (e) => {
    const val = passInput.value;
    const email = document.getElementById('reg-email').value;
    const confirm = document.getElementById('reg-password-confirm').value;

    // VALIDACIÓN FINAL ANTES DE ENVIAR
    let error = "";

    if (!email.includes('@')) error = "El email no tiene un formato de red válido.";
    if (val.length < 8) error = "La contraseña es demasiado corta para los estándares de seguridad.";
    if (val !== confirm) error = "La sincronización de contraseñas ha fallado (no coinciden).";

    if (error !== "") {
        e.preventDefault(); // 🚨 AQUÍ BLOQUEAMOS EL ENVÍO
        mostrarAviso(error, "error"); // Usamos tu sistema Aero Toast
        console.error("Envío bloqueado: " + error);
    } else {
        mostrarAviso("Sincronizando con el servidor...", "success");
        // Aquí iría tu fetch('/api/register', ...)
    }
});






// Simulación de grupos del usuario
let misGrupos = ['Muro Global'];

function abrirModalGrupo() {
    document.getElementById('modal-grupo').style.display = 'flex';
}

function cerrarModalGrupo() {
    document.getElementById('modal-grupo').style.display = 'none';
}

function confirmarCrearGrupo() {
    const nombre = document.getElementById('nombre-grupo').value;
    if (nombre) {
        mostrarAviso(`Grupo "${nombre}" creado. Ahora publica una invitación.`, "success");
        cerrarModalGrupo();
    }
}

function aceptarInvitacion(nombreGrupo) {
    if (!misGrupos.includes(nombreGrupo)) {
        misGrupos.push(nombreGrupo);
        actualizarSidebar();
        mostrarAviso(`¡Te has unido a ${nombreGrupo}!`, "success");
    } else {
        mostrarAviso("Ya eres miembro de este grupo.", "error");
    }
}

function actualizarSidebar() {
    const lista = document.getElementById('lista-grupos');
    lista.innerHTML = "";
    misGrupos.forEach(grupo => {
        const li = document.createElement('li');
        li.className = "grupo-item" + (grupo === "Muro Global" ? " active" : "");
        li.textContent = `🌐 ${grupo}`;
        lista.appendChild(li);
    });
}





/**
 * Limpia el texto de entrada para evitar caracteres sospechosos
 * de inyección SQL o scripts.
 */
 function sanitizarInput(texto) {
    // Eliminamos comillas simples, guiones dobles y puntos y coma
    // que son las herramientas básicas de un SQL Injection.
    return texto.replace(/['";\-\-\/\*]/g, "").trim();
}

// Ejemplo de uso en el evento de Login:
const emailLimpio = sanitizarInput(document.getElementById('login-email').value);
const passLimpia = sanitizarInput(document.getElementById('login-password').value);


function esIntentoSQL(texto) {
    const palabrasProhibidas = ["SELECT", "DROP", "INSERT", "DELETE", "UPDATE", "UNION", "WHERE"];
    const textoUpper = texto.toUpperCase();
    
    return palabrasProhibidas.some(palabra => textoUpper.includes(palabra));
}

// Integración en el validador que ya teníamos:
formRegistro.addEventListener('submit', (e) => {
    const email = document.getElementById('reg-email').value;
    
    if (esIntentoSQL(email)) {
        e.preventDefault();
        mostrarAviso("⚠️ Actividad sospechosa detectada en los campos.", "error");
        console.warn("Intento de inyección bloqueado en el frontend.");
        return;
    }
    // ... resto de validaciones (fuerza de contraseña, etc)
});