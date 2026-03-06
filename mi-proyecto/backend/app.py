"""
AeroForum - Backend Flask Seguro
=================================
Backend para foro de mensajes con autenticación JWT, hash bcrypt,
protección contra SQL Injection y validaciones completas.
"""

from flask import Flask, request, jsonify, g
from flask_cors import CORS
import sqlite3
import os
import re
import bcrypt
import jwt
from datetime import datetime, timedelta
from functools import wraps

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ══════════════════════════════════════════════════════════════════════════════

app = Flask(__name__)
CORS(app, supports_credentials=True, origins=['http://localhost:8080', 'http://127.0.0.1:8080'])

# Configuración de seguridad
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_secret_key_change_in_production')
app.config['JWT_EXPIRATION_HOURS'] = 24
app.config['JWT_REFRESH_DAYS'] = 7

# Base de datos
DB_PATH = '/app/data/foro.db'

# ══════════════════════════════════════════════════════════════════════════════
# BASE DE DATOS
# ══════════════════════════════════════════════════════════════════════════════

def get_db_connection():
    """Obtiene conexión a la base de datos con configuración segura."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Activar foreign keys para integridad referencial
    conn.execute('PRAGMA foreign_keys = ON')
    return conn

def init_db():
    """Inicializa la base de datos con las tablas necesarias."""
    conn = get_db_connection()

    # Tabla de usuarios
    conn.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            nombre TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            rol TEXT DEFAULT 'usuario',
            bio TEXT DEFAULT '',
            avatar TEXT DEFAULT NULL,
            fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ultimo_acceso TIMESTAMP,
            estado TEXT DEFAULT 'offline'
        )
    ''')

    # Tabla de mensajes (hilos)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS mensajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            sala_id INTEGER DEFAULT 1,
            titulo TEXT,
            contenido TEXT NOT NULL,
            padre_id INTEGER DEFAULT NULL,
            votos INTEGER DEFAULT 0,
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            actualizado_en TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES usuarios (id) ON DELETE CASCADE,
            FOREIGN KEY (padre_id) REFERENCES mensajes (id) ON DELETE CASCADE
        )
    ''')

    # Tabla de salas
    conn.execute('''
        CREATE TABLE IF NOT EXISTS salas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            descripcion TEXT DEFAULT '',
            icono TEXT DEFAULT '💬',
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Tabla de votos (para evitar votos duplicados)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS votos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mensaje_id INTEGER NOT NULL,
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES usuarios (id) ON DELETE CASCADE,
            FOREIGN KEY (mensaje_id) REFERENCES mensajes (id) ON DELETE CASCADE,
            UNIQUE(user_id, mensaje_id)
        )
    ''')

    # Tabla de reportes
    conn.execute('''
        CREATE TABLE IF NOT EXISTS reportes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            objetivo_id INTEGER NOT NULL,
            reportador_id INTEGER NOT NULL,
            razon TEXT NOT NULL,
            estado TEXT DEFAULT 'pendiente',
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            resuelto_en TIMESTAMP,
            FOREIGN KEY (reportador_id) REFERENCES usuarios (id) ON DELETE CASCADE
        )
    ''')

    # Insertar salas por defecto si no existen
    salas_defecto = [
        ('Tecnología', 'Debates sobre software, hardware y redes.', '💻'),
        ('Música', 'Comparte artistas, álbumes y conciertos.', '🎵'),
        ('Deportes', 'Fútbol, baloncesto, motor y más.', '⚽'),
        ('Cine & Series', 'Reseñas, spoilers y recomendaciones.', '🎬'),
        ('Programación', 'Código, proyectos open source y tutoriales.', '🖥️'),
    ]

    for nombre, desc, icono in salas_defecto:
        try:
            conn.execute(
                'INSERT OR IGNORE INTO salas (nombre, descripcion, icono) VALUES (?, ?, ?)',
                (nombre, desc, icono)
            )
        except:
            pass

    conn.commit()
    conn.close()

# Inicializar BD
if not os.path.exists('/app/data'):
    os.makedirs('/app/data')
init_db()

# ══════════════════════════════════════════════════════════════════════════════
# UTILIDADES DE SEGURIDAD
# ══════════════════════════════════════════════════════════════════════════════

def hash_password(password: str) -> str:
    """Hashea una contraseña usando bcrypt."""
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verifica una contraseña contra su hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except:
        return False

def generate_token(user_id: int, nombre: str, rol: str) -> str:
    """Genera un JWT para el usuario."""
    payload = {
        'user_id': user_id,
        'nombre': nombre,
        'rol': rol,
        'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS']),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def decode_token(token: str) -> dict:
    """Decodifica y valida un JWT."""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return {'valid': True, 'data': payload}
    except jwt.ExpiredSignatureError:
        return {'valid': False, 'error': 'Token expirado'}
    except jwt.InvalidTokenError:
        return {'valid': False, 'error': 'Token inválido'}

def token_required(f):
    """Decorador para endpoints que requieren autenticación."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None

        # Buscar token en cookies o headers
        if request.cookies.get('auth_token'):
            token = request.cookies.get('auth_token')
        elif request.headers.get('Authorization'):
            auth_header = request.headers.get('Authorization')
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'error': 'Token de autenticación requerido'}), 401

        result = decode_token(token)
        if not result['valid']:
            return jsonify({'error': result['error']}), 401

        g.current_user = result['data']
        return f(*args, **kwargs)

    return decorated

def mod_required(f):
    """Decorador para endpoints que requieren rol moderador o admin."""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if g.current_user.get('rol') not in ['moderador', 'admin']:
            return jsonify({'error': 'Permisos insuficientes'}), 403
        return f(*args, **kwargs)
    return decorated

# ══════════════════════════════════════════════════════════════════════════════
# VALIDACIONES
# ══════════════════════════════════════════════════════════════════════════════

def validar_email(email: str) -> bool:
    """Valida formato de email."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validar_password(password: str) -> dict:
    """Valida fortaleza de contraseña."""
    result = {'valid': True, 'errors': [], 'score': 0}

    if len(password) < 8:
        result['valid'] = False
        result['errors'].append('La contraseña debe tener al menos 8 caracteres')
    if len(password) >= 12:
        result['score'] += 1
    if re.search(r'[A-Z]', password):
        result['score'] += 1
    if re.search(r'[a-z]', password):
        result['score'] += 1
    if re.search(r'[0-9]', password):
        result['score'] += 1
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        result['score'] += 1

    return result

def validar_nombre(nombre: str) -> dict:
    """Valida nombre de usuario."""
    result = {'valid': True, 'errors': []}

    if len(nombre) < 3:
        result['valid'] = False
        result['errors'].append('El nombre debe tener al menos 3 caracteres')
    if len(nombre) > 30:
        result['valid'] = False
        result['errors'].append('El nombre no puede exceder 30 caracteres')
    if not re.match(r'^[a-zA-Z0-9_]+$', nombre):
        result['valid'] = False
        result['errors'].append('El nombre solo puede contener letras, números y guión bajo')

    return result

def sanitizar_texto(texto: str, max_length: int = 2000) -> str:
    """Sanitiza texto para prevenir XSS."""
    if not texto:
        return ''
    # Escapar caracteres HTML peligrosos
    texto = texto.replace('&', '&amp;')
    texto = texto.replace('<', '&lt;')
    texto = texto.replace('>', '&gt;')
    texto = texto.replace('"', '&quot;')
    texto = texto.replace("'", '&#x27;')
    # Limitar longitud
    return texto[:max_length]

def respuesta_usuario(row) -> dict:
    """Convierte una fila de usuario a diccionario seguro (sin password)."""
    return {
        'id': row['id'],
        'nombre': row['nombre'],
        'email': row['email'],
        'rol': row['rol'],
        'bio': row['bio'] or '',
        'avatar': row['avatar'],
        'fecha_registro': row['fecha_registro'],
        'estado': row['estado'] or 'offline',
        'mensajes_total': row['mensajes_total'] if 'mensajes_total' in row.keys() else 0
    }

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS - AUTENTICACIÓN
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/health', methods=['GET'])
def health_check():
    """Endpoint para verificar que el servidor está activo."""
    return jsonify({'status': 'ok', 'timestamp': datetime.utcnow().isoformat()})

@app.route('/api/register', methods=['POST'])
def register():
    """
    Registra un nuevo usuario.
    Requiere: email, password, nombre (opcional, se genera del email si no se proporciona)
    """
    print("=== INICIO REGISTRO ===")
    try:
        data = request.json
        print(f"Datos recibidos: {data}")
        if not data:
            return jsonify({'error': 'Datos no proporcionados'}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        # Generar nombre del email si no se proporciona
        nombre = data.get('nombre', '').strip()
        if not nombre:
            # Sanear el nombre generado del email (solo letras, números, guión bajo)
            nombre_raw = email.split('@')[0]
            nombre = re.sub(r'[^a-zA-Z0-9_]', '_', nombre_raw)
            # Eliminar guiones bajos múltiples y de los extremos
            nombre = re.sub(r'_+', '_', nombre).strip('_')
            # Asegurar mínimo 3 caracteres
            if len(nombre) < 3:
                nombre = 'user_' + nombre_raw[:10].replace('.', '_')
        
        print(f"Email: {email}, Nombre generado: {nombre}")

        # Validaciones
        if not email:
            return jsonify({'error': 'El email es obligatorio'}), 400
        if not validar_email(email):
            return jsonify({'error': 'Formato de email no válido'}), 400
        if not password:
            return jsonify({'error': 'La contraseña es obligatoria'}), 400

        pass_validation = validar_password(password)
        if not pass_validation['valid']:
            return jsonify({'error': pass_validation['errors'][0]}), 400
        if pass_validation['score'] < 2:
            return jsonify({'error': 'La contraseña es demasiado débil. Incluye mayúsculas, números y símbolos'}), 400

        nombre_validation = validar_nombre(nombre)
        if not nombre_validation['valid']:
            return jsonify({'error': nombre_validation['errors'][0]}), 400

        conn = get_db_connection()

        # Verificar si email ya existe (consulta parametrizada - previene SQLi)
        existing = conn.execute(
            'SELECT id FROM usuarios WHERE email = ?', (email,)
        ).fetchone()
        if existing:
            conn.close()
            return jsonify({'error': 'Este email ya está registrado'}), 409

        # Verificar si nombre ya existe
        existing = conn.execute(
            'SELECT id FROM usuarios WHERE nombre = ?', (nombre,)
        ).fetchone()
        if existing:
            conn.close()
            return jsonify({'error': 'Este nombre de usuario ya está en uso'}), 409

        # Hash de contraseña y inserción
        password_hash = hash_password(password)

        cursor = conn.execute(
            '''INSERT INTO usuarios (email, nombre, password_hash, rol, estado)
               VALUES (?, ?, ?, 'usuario', 'offline')''',
            (email, nombre, password_hash)
        )
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return jsonify({
            'mensaje': 'Usuario registrado correctamente',
            'usuario': {'id': user_id, 'nombre': nombre, 'email': email}
        }), 201

    except Exception as e:
        import traceback
        print(f"Error en registro: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': f'Error interno: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    """
    Inicia sesión de usuario.
    Requiere: email, password
    Retorna: token JWT en cookie HttpOnly y datos de usuario
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Datos no proporcionados'}), 400

        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password:
            return jsonify({'error': 'Email y contraseña son obligatorios'}), 400

        conn = get_db_connection()

        # Consulta parametrizada - previene SQL Injection
        user = conn.execute(
            'SELECT * FROM usuarios WHERE email = ?', (email,)
        ).fetchone()

        if not user:
            conn.close()
            # Mensaje genérico para no revelar si el email existe
            return jsonify({'error': 'Credenciales incorrectas'}), 401

        # Verificar contraseña
        if not verify_password(password, user['password_hash']):
            conn.close()
            return jsonify({'error': 'Credenciales incorrectas'}), 401

        # Actualizar último acceso y estado
        conn.execute(
            '''UPDATE usuarios SET ultimo_acceso = ?, estado = 'online'
               WHERE id = ?''',
            (datetime.utcnow().isoformat(), user['id'])
        )

        # Contar mensajes del usuario
        mensajes_total = conn.execute(
            'SELECT COUNT(*) as count FROM mensajes WHERE user_id = ?',
            (user['id'],)
        ).fetchone()['count']

        conn.commit()
        conn.close()

        # Generar token JWT
        token = generate_token(user['id'], user['nombre'], user['rol'])

        # Preparar respuesta
        usuario = respuesta_usuario(user)
        usuario['mensajes_total'] = mensajes_total

        response = jsonify({
            'mensaje': 'Inicio de sesión exitoso',
            'usuario': usuario
        })

        # Cookie HttpOnly, Secure, SameSite
        response.set_cookie(
            'auth_token',
            token,
            max_age=app.config['JWT_EXPIRATION_HOURS'] * 3600,
            httponly=True,
            secure=False,  # Cambiar a True en producción con HTTPS
            samesite='Lax'
        )

        return response

    except Exception as e:
        print(f"Error en login: {str(e)}")
        return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/api/logout', methods=['POST'])
@token_required
def logout():
    """Cierra la sesión del usuario."""
    try:
        conn = get_db_connection()
        conn.execute(
            "UPDATE usuarios SET estado = 'offline' WHERE id = ?",
            (g.current_user['user_id'],)
        )
        conn.commit()
        conn.close()

        response = jsonify({'mensaje': 'Sesión cerrada correctamente'})
        response.delete_cookie('auth_token')

        return response
    except Exception as e:
        print(f"Error en logout: {str(e)}")
        return jsonify({'error': 'Error al cerrar sesión'}), 500

@app.route('/api/session', methods=['GET'])
def get_session():
    """Verifica si hay una sesión activa y retorna datos del usuario."""
    token = None

    if request.cookies.get('auth_token'):
        token = request.cookies.get('auth_token')
    elif request.headers.get('Authorization'):
        auth_header = request.headers.get('Authorization')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

    if not token:
        return jsonify({'autenticado': False}), 200

    result = decode_token(token)
    if not result['valid']:
        return jsonify({'autenticado': False, 'error': result['error']}), 200

    try:
        conn = get_db_connection()
        user = conn.execute(
            'SELECT * FROM usuarios WHERE id = ?',
            (result['data']['user_id'],)
        ).fetchone()

        if not user:
            conn.close()
            return jsonify({'autenticado': False}), 200

        mensajes_total = conn.execute(
            'SELECT COUNT(*) as count FROM mensajes WHERE user_id = ?',
            (user['id'],)
        ).fetchone()['count']
        conn.close()

        usuario = respuesta_usuario(user)
        usuario['mensajes_total'] = mensajes_total

        return jsonify({
            'autenticado': True,
            'usuario': usuario
        }), 200

    except Exception as e:
        print(f"Error en session: {str(e)}")
        return jsonify({'autenticado': False}), 200

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS - MENSAJES / HILOS
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/mensajes', methods=['GET'])
def get_mensajes():
    """
    Obtiene mensajes públicos (hilos principales).
    Parámetros opcionales: sala_id, limite, pagina
    """
    try:
        sala_id = request.args.get('sala_id', type=int)
        limite = min(request.args.get('limite', 20, type=int), 100)
        pagina = request.args.get('pagina', 1, type=int)
        offset = (pagina - 1) * limite

        conn = get_db_connection()

        # Construir consulta base
        query = '''
            SELECT m.id, m.titulo, m.contenido, m.votos, m.creado_en,
                   m.sala_id, m.padre_id,
                   u.nombre as autor, u.rol as autor_rol, u.avatar as autor_avatar,
                   s.nombre as sala_nombre, s.icono as sala_icono,
                   (SELECT COUNT(*) FROM mensajes r WHERE r.padre_id = m.id) as respuestas_count
            FROM mensajes m
            JOIN usuarios u ON m.user_id = u.id
            LEFT JOIN salas s ON m.sala_id = s.id
            WHERE m.padre_id IS NULL
        '''
        params = []

        if sala_id:
            query += ' AND m.sala_id = ?'
            params.append(sala_id)

        query += ' ORDER BY m.creado_en DESC LIMIT ? OFFSET ?'
        params.extend([limite, offset])

        mensajes = conn.execute(query, params).fetchall()

        # Contar total para paginación
        count_query = 'SELECT COUNT(*) as total FROM mensajes WHERE padre_id IS NULL'
        count_params = []
        if sala_id:
            count_query += ' AND sala_id = ?'
            count_params.append(sala_id)
        total = conn.execute(count_query, count_params).fetchone()['total']

        conn.close()

        resultado = []
        for m in mensajes:
            resultado.append({
                'id': m['id'],
                'titulo': m['titulo'] or '',
                'contenido': m['contenido'],
                'autor': m['autor'],
                'autor_rol': m['autor_rol'],
                'autor_avatar': m['autor_avatar'],
                'sala_id': m['sala_id'],
                'sala_nombre': m['sala_nombre'],
                'sala_icono': m['sala_icono'],
                'votos': m['votos'],
                'respuestas': m['respuestas_count'],
                'fecha': m['creado_en']
            })

        return jsonify({
            'mensajes': resultado,
            'total': total,
            'pagina': pagina,
            'total_paginas': (total + limite - 1) // limite
        }), 200

    except Exception as e:
        print(f"Error en get_mensajes: {str(e)}")
        return jsonify({'error': 'Error al obtener mensajes'}), 500

@app.route('/api/mensajes', methods=['POST'])
@token_required
def crear_mensaje():
    """
    Crea un nuevo mensaje/hilo.
    Requiere autenticación.
    Body: titulo (opcional), contenido, sala_id (opcional), padre_id (opcional para respuestas)
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Datos no proporcionados'}), 400

        contenido = data.get('contenido', '').strip()
        titulo = data.get('titulo', '').strip()
        sala_id = data.get('sala_id', 1)
        padre_id = data.get('padre_id')  # Para respuestas

        # Validaciones
        if not contenido:
            return jsonify({'error': 'El contenido es obligatorio'}), 400
        if len(contenido) > 2000:
            return jsonify({'error': 'El contenido excede el límite de 2000 caracteres'}), 400

        # Sanitizar para prevenir XSS
        contenido = sanitizar_texto(contenido, 2000)
        titulo = sanitizar_texto(titulo, 120) if titulo else None

        conn = get_db_connection()

        # Si es respuesta, verificar que el mensaje padre existe
        if padre_id:
            padre = conn.execute(
                'SELECT id, sala_id FROM mensajes WHERE id = ?', (padre_id,)
            ).fetchone()
            if not padre:
                conn.close()
                return jsonify({'error': 'El mensaje padre no existe'}), 404
            sala_id = padre['sala_id']  # Heredar sala del padre
            titulo = None  # Las respuestas no tienen título

        # Insertar mensaje
        cursor = conn.execute(
            '''INSERT INTO mensajes (user_id, sala_id, titulo, contenido, padre_id)
               VALUES (?, ?, ?, ?, ?)''',
            (g.current_user['user_id'], sala_id, titulo, contenido, padre_id)
        )
        mensaje_id = cursor.lastrowid

        conn.commit()
        conn.close()

        return jsonify({
            'mensaje': 'Mensaje publicado correctamente',
            'id': mensaje_id
        }), 201

    except Exception as e:
        print(f"Error en crear_mensaje: {str(e)}")
        return jsonify({'error': 'Error al publicar mensaje'}), 500

@app.route('/api/mensajes/<int:mensaje_id>', methods=['GET'])
def get_mensaje(mensaje_id):
    """Obtiene un mensaje específico con sus respuestas."""
    try:
        conn = get_db_connection()

        # Obtener mensaje principal
        mensaje = conn.execute('''
            SELECT m.id, m.titulo, m.contenido, m.votos, m.creado_en, m.sala_id,
                   u.nombre as autor, u.rol as autor_rol, u.avatar as autor_avatar,
                   s.nombre as sala_nombre, s.icono as sala_icono
            FROM mensajes m
            JOIN usuarios u ON m.user_id = u.id
            LEFT JOIN salas s ON m.sala_id = s.id
            WHERE m.id = ?
        ''', (mensaje_id,)).fetchone()

        if not mensaje:
            conn.close()
            return jsonify({'error': 'Mensaje no encontrado'}), 404

        # Obtener respuestas
        respuestas = conn.execute('''
            SELECT m.id, m.contenido, m.votos, m.creado_en,
                   u.nombre as autor, u.rol as autor_rol, u.avatar as autor_avatar
            FROM mensajes m
            JOIN usuarios u ON m.user_id = u.id
            WHERE m.padre_id = ?
            ORDER BY m.creado_en ASC
        ''', (mensaje_id,)).fetchall()

        conn.close()

        resultado = {
            'id': mensaje['id'],
            'titulo': mensaje['titulo'] or '',
            'contenido': mensaje['contenido'],
            'autor': mensaje['autor'],
            'autor_rol': mensaje['autor_rol'],
            'autor_avatar': mensaje['autor_avatar'],
            'sala_id': mensaje['sala_id'],
            'sala_nombre': mensaje['sala_nombre'],
            'sala_icono': mensaje['sala_icono'],
            'votos': mensaje['votos'],
            'fecha': mensaje['creado_en'],
            'respuestas': [{
                'id': r['id'],
                'contenido': r['contenido'],
                'autor': r['autor'],
                'autor_rol': r['autor_rol'],
                'autor_avatar': r['autor_avatar'],
                'votos': r['votos'],
                'fecha': r['creado_en']
            } for r in respuestas]
        }

        return jsonify(resultado), 200

    except Exception as e:
        print(f"Error en get_mensaje: {str(e)}")
        return jsonify({'error': 'Error al obtener mensaje'}), 500

@app.route('/api/mensajes/<int:mensaje_id>', methods=['DELETE'])
@token_required
def eliminar_mensaje(mensaje_id):
    """Elimina un mensaje (solo el autor o moderador/admin)."""
    try:
        conn = get_db_connection()

        mensaje = conn.execute(
            'SELECT id, user_id FROM mensajes WHERE id = ?', (mensaje_id,)
        ).fetchone()

        if not mensaje:
            conn.close()
            return jsonify({'error': 'Mensaje no encontrado'}), 404

        # Verificar permisos
        es_autor = mensaje['user_id'] == g.current_user['user_id']
        es_mod_admin = g.current_user['rol'] in ['moderador', 'admin']

        if not es_autor and not es_mod_admin:
            conn.close()
            return jsonify({'error': 'No tienes permiso para eliminar este mensaje'}), 403

        conn.execute('DELETE FROM mensajes WHERE id = ?', (mensaje_id,))
        conn.commit()
        conn.close()

        return jsonify({'mensaje': 'Mensaje eliminado correctamente'}), 200

    except Exception as e:
        print(f"Error en eliminar_mensaje: {str(e)}")
        return jsonify({'error': 'Error al eliminar mensaje'}), 500

@app.route('/api/mensajes/<int:mensaje_id>/votar', methods=['POST'])
@token_required
def votar_mensaje(mensaje_id):
    """Vota por un mensaje (un voto por usuario)."""
    try:
        conn = get_db_connection()

        # Verificar que el mensaje existe
        mensaje = conn.execute(
            'SELECT id FROM mensajes WHERE id = ?', (mensaje_id,)
        ).fetchone()

        if not mensaje:
            conn.close()
            return jsonify({'error': 'Mensaje no encontrado'}), 404

        # Verificar si ya votó
        voto_existente = conn.execute(
            'SELECT id FROM votos WHERE user_id = ? AND mensaje_id = ?',
            (g.current_user['user_id'], mensaje_id)
        ).fetchone()

        if voto_existente:
            conn.close()
            return jsonify({'error': 'Ya has votado este mensaje'}), 400

        # Registrar voto
        conn.execute(
            'INSERT INTO votos (user_id, mensaje_id) VALUES (?, ?)',
            (g.current_user['user_id'], mensaje_id)
        )
        conn.execute(
            'UPDATE mensajes SET votos = votos + 1 WHERE id = ?',
            (mensaje_id,)
        )

        # Obtener nuevo conteo
        nuevos_votos = conn.execute(
            'SELECT votos FROM mensajes WHERE id = ?', (mensaje_id,)
        ).fetchone()['votos']

        conn.commit()
        conn.close()

        return jsonify({'mensaje': 'Voto registrado', 'votos': nuevos_votos}), 200

    except Exception as e:
        print(f"Error en votar_mensaje: {str(e)}")
        return jsonify({'error': 'Error al votar'}), 500

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS - SALAS
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/salas', methods=['GET'])
def get_salas():
    """Obtiene todas las salas disponibles."""
    try:
        conn = get_db_connection()

        salas = conn.execute('''
            SELECT s.id, s.nombre, s.descripcion, s.icono,
                   (SELECT COUNT(DISTINCT m.user_id) FROM mensajes m WHERE m.sala_id = s.id) as miembros,
                   (SELECT COUNT(*) FROM mensajes m WHERE m.sala_id = s.id) as mensajes
            FROM salas s
            ORDER BY s.nombre
        ''').fetchall()

        conn.close()

        return jsonify({
            'salas': [{
                'id': s['id'],
                'nombre': s['nombre'],
                'descripcion': s['descripcion'] or '',
                'icono': s['icono'] or '💬',
                'miembros': s['miembros'] or 0,
                'mensajes': s['mensajes'] or 0
            } for s in salas]
        }), 200

    except Exception as e:
        print(f"Error en get_salas: {str(e)}")
        return jsonify({'error': 'Error al obtener salas'}), 500

@app.route('/api/salas/<int:sala_id>', methods=['GET'])
def get_sala(sala_id):
    """Obtiene una sala específica."""
    try:
        conn = get_db_connection()

        sala = conn.execute(
            'SELECT id, nombre, descripcion, icono FROM salas WHERE id = ?',
            (sala_id,)
        ).fetchone()

        conn.close()

        if not sala:
            return jsonify({'error': 'Sala no encontrada'}), 404

        return jsonify({
            'sala': {
                'id': sala['id'],
                'nombre': sala['nombre'],
                'descripcion': sala['descripcion'] or '',
                'icono': sala['icono'] or '💬'
            }
        }), 200

    except Exception as e:
        print(f"Error en get_sala: {str(e)}")
        return jsonify({'error': 'Error al obtener sala'}), 500

@app.route('/api/salas', methods=['POST'])
@mod_required
def crear_sala():
    """Crea una nueva sala (solo moderadores/admins)."""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Datos no proporcionados'}), 400

        nombre = data.get('nombre', '').strip()
        descripcion = data.get('descripcion', '').strip()
        icono = data.get('icono', '💬')

        if not nombre:
            return jsonify({'error': 'El nombre es obligatorio'}), 400
        if len(nombre) > 50:
            return jsonify({'error': 'El nombre no puede exceder 50 caracteres'}), 400

        nombre = sanitizar_texto(nombre, 50)
        descripcion = sanitizar_texto(descripcion, 200)

        conn = get_db_connection()

        try:
            cursor = conn.execute(
                'INSERT INTO salas (nombre, descripcion, icono) VALUES (?, ?, ?)',
                (nombre, descripcion, icono)
            )
            sala_id = cursor.lastrowid
            conn.commit()
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'error': 'Ya existe una sala con ese nombre'}), 409

        conn.close()

        return jsonify({
            'mensaje': 'Sala creada correctamente',
            'sala': {'id': sala_id, 'nombre': nombre, 'descripcion': descripcion, 'icono': icono}
        }), 201

    except Exception as e:
        print(f"Error en crear_sala: {str(e)}")
        return jsonify({'error': 'Error al crear sala'}), 500

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS - PERFIL
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/perfil', methods=['GET'])
@token_required
def get_perfil():
    """Obtiene el perfil del usuario autenticado."""
    try:
        conn = get_db_connection()

        user = conn.execute(
            'SELECT * FROM usuarios WHERE id = ?',
            (g.current_user['user_id'],)
        ).fetchone()

        if not user:
            conn.close()
            return jsonify({'error': 'Usuario no encontrado'}), 404

        mensajes_total = conn.execute(
            'SELECT COUNT(*) as count FROM mensajes WHERE user_id = ?',
            (user['id'],)
        ).fetchone()['count']

        conn.close()

        usuario = respuesta_usuario(user)
        usuario['mensajes_total'] = mensajes_total

        return jsonify({'usuario': usuario}), 200

    except Exception as e:
        print(f"Error en get_perfil: {str(e)}")
        return jsonify({'error': 'Error al obtener perfil'}), 500

@app.route('/api/perfil', methods=['PATCH'])
@token_required
def actualizar_perfil():
    """Actualiza el perfil del usuario."""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Datos no proporcionados'}), 400

        nombre = data.get('nombre', '').strip()
        bio = data.get('bio', '').strip()
        avatar = data.get('avatar')

        conn = get_db_connection()

        # Si se cambia el nombre, verificar que no exista
        if nombre:
            validation = validar_nombre(nombre)
            if not validation['valid']:
                conn.close()
                return jsonify({'error': validation['errors'][0]}), 400

            existing = conn.execute(
                'SELECT id FROM usuarios WHERE nombre = ? AND id != ?',
                (nombre, g.current_user['user_id'])
            ).fetchone()
            if existing:
                conn.close()
                return jsonify({'error': 'Este nombre ya está en uso'}), 409

        # Construir update dinámico
        updates = []
        params = []

        if nombre:
            updates.append('nombre = ?')
            params.append(sanitizar_texto(nombre, 30))
        if bio is not None:
            updates.append('bio = ?')
            params.append(sanitizar_texto(bio, 300))
        if avatar is not None:
            updates.append('avatar = ?')
            params.append(avatar)

        if not updates:
            conn.close()
            return jsonify({'error': 'No hay datos para actualizar'}), 400

        params.append(g.current_user['user_id'])
        query = f"UPDATE usuarios SET {', '.join(updates)} WHERE id = ?"

        conn.execute(query, params)
        conn.commit()
        conn.close()

        return jsonify({'mensaje': 'Perfil actualizado correctamente'}), 200

    except Exception as e:
        print(f"Error en actualizar_perfil: {str(e)}")
        return jsonify({'error': 'Error al actualizar perfil'}), 500

@app.route('/api/perfil/password', methods=['PATCH'])
@token_required
def cambiar_password():
    """Cambia la contraseña del usuario."""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Datos no proporcionados'}), 400

        actual = data.get('actual', '')
        nueva = data.get('nueva', '')

        if not actual or not nueva:
            return jsonify({'error': 'Debes proporcionar la contraseña actual y la nueva'}), 400

        validation = validar_password(nueva)
        if not validation['valid']:
            return jsonify({'error': validation['errors'][0]}), 400
        if validation['score'] < 2:
            return jsonify({'error': 'La nueva contraseña es demasiado débil'}), 400

        conn = get_db_connection()

        user = conn.execute(
            'SELECT password_hash FROM usuarios WHERE id = ?',
            (g.current_user['user_id'],)
        ).fetchone()

        if not verify_password(actual, user['password_hash']):
            conn.close()
            return jsonify({'error': 'La contraseña actual es incorrecta'}), 401

        nuevo_hash = hash_password(nueva)
        conn.execute(
            'UPDATE usuarios SET password_hash = ? WHERE id = ?',
            (nuevo_hash, g.current_user['user_id'])
        )
        conn.commit()
        conn.close()

        return jsonify({'mensaje': 'Contraseña actualizada correctamente'}), 200

    except Exception as e:
        print(f"Error en cambiar_password: {str(e)}")
        return jsonify({'error': 'Error al cambiar contraseña'}), 500

@app.route('/api/perfil', methods=['DELETE'])
@token_required
def eliminar_cuenta():
    """Elimina la cuenta del usuario."""
    try:
        conn = get_db_connection()

        # El CASCADE elimina automáticamente los mensajes y votos asociados
        conn.execute(
            'DELETE FROM usuarios WHERE id = ?',
            (g.current_user['user_id'],)
        )
        conn.commit()
        conn.close()

        response = jsonify({'mensaje': 'Cuenta eliminada correctamente'})
        response.delete_cookie('auth_token')

        return response

    except Exception as e:
        print(f"Error en eliminar_cuenta: {str(e)}")
        return jsonify({'error': 'Error al eliminar cuenta'}), 500

# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS - REPORTES (MODERACIÓN)
# ══════════════════════════════════════════════════════════════════════════════

@app.route('/api/reportes', methods=['GET'])
@mod_required
def get_reportes():
    """Obtiene lista de reportes (solo moderadores/admins)."""
    try:
        estado = request.args.get('estado', 'pendiente')

        conn = get_db_connection()

        reportes = conn.execute('''
            SELECT r.id, r.tipo, r.objetivo_id, r.razon, r.estado, r.creado_en,
                   u.nombre as reportador
            FROM reportes r
            JOIN usuarios u ON r.reportador_id = u.id
            WHERE r.estado = ?
            ORDER BY r.creado_en DESC
        ''', (estado,)).fetchall()

        conn.close()

        return jsonify({
            'reportes': [{
                'id': r['id'],
                'tipo': r['tipo'],
                'objetivo_id': r['objetivo_id'],
                'razon': r['razon'],
                'estado': r['estado'],
                'fecha': r['creado_en'],
                'reportador': r['reportador']
            } for r in reportes]
        }), 200

    except Exception as e:
        print(f"Error en get_reportes: {str(e)}")
        return jsonify({'error': 'Error al obtener reportes'}), 500

@app.route('/api/reportes', methods=['POST'])
@token_required
def crear_reporte():
    """Crea un nuevo reporte."""
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Datos no proporcionados'}), 400

        tipo = data.get('tipo', 'mensaje')
        objetivo_id = data.get('objetivo_id')
        razon = data.get('razon', '').strip()

        if not objetivo_id or not razon:
            return jsonify({'error': 'Faltan datos obligatorios'}), 400

        conn = get_db_connection()

        conn.execute(
            '''INSERT INTO reportes (tipo, objetivo_id, reportador_id, razon)
               VALUES (?, ?, ?, ?)''',
            (tipo, objetivo_id, g.current_user['user_id'], sanitizar_texto(razon, 200))
        )
        conn.commit()
        conn.close()

        return jsonify({'mensaje': 'Reporte enviado correctamente'}), 201

    except Exception as e:
        print(f"Error en crear_reporte: {str(e)}")
        return jsonify({'error': 'Error al crear reporte'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)