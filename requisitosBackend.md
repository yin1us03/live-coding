# Requisitos mínimos de seguridad para un backend Flask (Python)

Este documento describe los **requisitos mínimos recomendados** para que un backend desarrollado con Flask y Python tenga un **alto nivel de seguridad en producción**.

---

# 1. Autenticación y gestión de sesiones

Nunca confiar en el cliente.

## Requisitos mínimos

* Usar tokens firmados (JWT) o sesiones seguras.
* Implementar:

  * expiración de tokens
  * refresh tokens
  * revocación de tokens
* Activar **2FA** en sistemas sensibles.
* **Rate limiting** en login.
* Bloqueo temporal tras múltiples intentos fallidos.

## Ejemplo

```python
from flask_jwt_extended import JWTManager
import os

jwt = JWTManager(app)
app.config["JWT_SECRET_KEY"] = os.environ["JWT_SECRET"]
```

Nunca hardcodear secretos.

---

# 2. Gestión segura de contraseñas

Nunca guardar contraseñas en texto plano.

## Requisitos mínimos

* Hash usando:

  * `bcrypt`
  * `argon2`
* Salt automático.
* Política de contraseñas fuertes.

## Ejemplo

```python
from passlib.hash import bcrypt

hashed_password = bcrypt.hash(password)
bcrypt.verify(password, hashed_password)
```

---

# 3. Validación y sanitización de datos

Todos los inputs deben validarse.

## Proteger contra

* SQL Injection
* Cross-Site Scripting (XSS)
* Cross-Site Request Forgery (CSRF)

## Requisitos

* Validar todos los inputs
* Usar ORM
* Escapar HTML cuando sea necesario
* Limitar tamaño de payload

## Ejemplo seguro

```python
User.query.filter_by(email=email).first()
```

---

# 4. Protección de API

Si el backend expone una API:

## Requisitos

* Rate limiting
* API keys o OAuth
* Logging de requests
* Limitar tamaño de requests

## Ejemplo

```python
limiter.limit("10 per minute")(login)
```

---

# 5. Gestión de secretos

Nunca almacenar secretos en el código.

## Usar

* variables de entorno
* gestores de secretos
* rotación periódica de claves

## Variables típicas

```
SECRET_KEY
DATABASE_URL
JWT_SECRET
API_KEYS
```

Nunca subir archivos `.env` al repositorio.

---

# 6. Seguridad HTTP

El servidor debe forzar seguridad.

## Requisitos

* HTTPS obligatorio
* Headers de seguridad

## Headers recomendados

```
Content-Security-Policy
X-Frame-Options
X-Content-Type-Options
Strict-Transport-Security
```

---

# 7. Protección contra ataques comunes

El sistema debe defenderse contra:

* ataques de fuerza bruta
* ataques DDoS
* ataques Man-in-the-Middle

## Medidas

* rate limiting
* firewall
* WAF
* proxies seguros

---

# 8. Logs y monitoreo

Necesario para detectar incidentes de seguridad.

## Registrar

* logins
* errores
* accesos sospechosos
* direcciones IP

## Nunca registrar

* contraseñas
* tokens
* datos sensibles

---

# 9. Dependencias seguras

Las dependencias son una fuente común de vulnerabilidades.

## Requisitos

* mantener dependencias actualizadas
* escanear vulnerabilidades regularmente

## Herramientas recomendadas

* Safety
* Dependabot
* pip-audit

---

# 10. Configuración de producción

No usar el servidor de desarrollo de Flask en producción.

## Usar

* Gunicorn o uWSGI
* Nginx como reverse proxy

## Arquitectura típica

```
Internet
   ↓
Nginx (HTTPS + rate limit)
   ↓
Gunicorn
   ↓
Flask
   ↓
Database
```

---

# 11. Principio de mínimo privilegio

Cada servicio debe tener **solo los permisos necesarios**.

## Ejemplos

* usuario de base de datos sin permisos de administrador
* contenedores sin privilegios root
* acceso restringido entre servicios

---

# 12. Tests de seguridad

Antes de desplegar a producción se deben realizar:

* escaneo de vulnerabilidades
* pentesting
* pruebas de fuzzing

## Herramientas útiles

* OWASP ZAP
* Burp Suite
* Snyk

---

# Checklist mínimo de seguridad

Antes de desplegar el backend, verificar:

* HTTPS obligatorio
* Hash seguro de contraseñas
* JWT o sesiones seguras
* Validación de inputs
* ORM para evitar SQL Injection
* Rate limiting
* Variables de entorno para secretos
* Logs de seguridad
* Dependencias actualizadas
* Reverse proxy (Nginx)

---

# Referencias

* OWASP Top 10
* Flask Security Best Practices
* Python Security Guidelines
