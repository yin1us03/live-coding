from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
CORS(app) # Necesario para que tu frontend (puerto 8080) pueda hablar con la API (puerto 3000)

DB_PATH = '/app/data/foro.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    # 🚨 AUDITORÍA: Asegúrate de que los campos creados coincidan con el project_specs
    conn.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS mensajes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            texto TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES usuarios (id)
        )
    ''')
    conn.commit()
    conn.close()

# Inicializamos la BD si no existe
if not os.path.exists('/app/data'):
    os.makedirs('/app/data')
init_db()

# --- ENDPOINTS ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    # 🚨 AUDITORÍA / SURVIVAL CHECKLIST: 
    # 1. ¿Qué pasa si email o password están vacíos? ¡Valida!
    # 2. ¿Vas a guardar la 'password' así tal cual en texto plano? Los auditores te suspenderán. 
    #    Investiga cómo "hashear" contraseñas en Python (ej: werkzeug.security).

    conn = get_db_connection()
    # 🚨 AUDITORÍA (SQLi): ¡NUNCA concatenes strings así: f"INSERT INTO usuarios (email) VALUES ('{email}')"!
    # Investiga cómo usar "Consultas Parametrizadas" en sqlite3 para evitar inyecciones SQL.
    
    # ... tu código de inserción aquí ...
    
    conn.close()
    return jsonify({"message": "Usuario registrado (o eso intentamos)"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    # ... Implementar lectura, comprobación de hash y generación de sesión/token ...
    pass

@app.route('/api/mensajes', methods=['GET', 'POST'])
def mensajes():
    if request.method == 'GET':
        # 🚨 AUDITORÍA (Reducción de info): Devuelve SOLO autor, texto y fecha.
        # No devuelvas las contraseñas hasheadas ni datos sensibles en este endpoint público.
        pass
        
    if request.method == 'POST':
        # 🚨 AUDITORÍA (Autenticación): ¿Cómo compruebas que quien envía el POST está realmente logueado?
        # 🚨 AUDITORÍA (XSS - Cross Site Scripting): Si el usuario envía en el 'texto' un <script>alert('hack')</script>, 
        # y tu frontend lo renderiza tal cual... ¡Boom! Investiga cómo sanitizar entradas o escapar salidas en el frontend.
        pass

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')