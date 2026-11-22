# EntradasYa — Auth (NestJS 12 / TypeScript)

Generado desde cero con CLI oficial NestJS 12.0.13, Bun como gestor, sin Observe ni DB. Implementa §§6 y 21 del contrato API; estado exclusivamente en memoria.

## Instalar y ejecutar

Desde la raíz del proyecto:

```sh
bun install --frozen-lockfile
cp .env.example .env
# Reemplazar JWT_SECRET por un valor aleatorio: openssl rand -hex 32
bun run build
bun run start:dev
```

Escucha en `127.0.0.1:4001`. Variables: `PORT` (1–65535, por defecto 4001), `JWT_SECRET` (obligatorio, mínimo 32 caracteres), `JWT_EXPIRES_IN` (por defecto `8h`; número positivo y unidad s/m/h/d/w). ConfigModule carga `.env` en desarrollo; pruebas ignoran archivos locales y usan secretos ficticios. No hay /api en el servicio: gateway pendiente.

## Endpoints

| Método | Ruta | Resultado |
|---|---|---|
| POST | /auth/register | 201 `{token,user}`; name/email/password y role opcional customer |
| POST | /auth/login | 200 `{token,user}` |
| GET | /health | 200 estado del proceso y almacenamiento memory |

Ejemplos de bodies:

```json
{"name":"Ana Pérez","email":"ana@example.com","password":"password-demo"}
```

```json
{"email":"cliente@entradasya.bo","password":"entradas123"}
```

Email normalizado con trim/minúsculas; nombre trim, 2–80 caracteres; password 8–1024 caracteres al registrarse y hasta 4096 bytes después de normalización Unicode NFKC. No se recortan espacios de contraseñas. Role omitido equivale a customer; organizer/doorman en registro público devuelve 403, desconocido devuelve 400.

Errores uniformes `{error:{code,message}}`: invalid_request/weak_password (400), forbidden (403), email_taken (409), invalid_credentials (401), not_found (404), internal_error (500). No se exponen hashes, passwords ni excepciones internas.

## Usuarios semilla

Todos usan contraseña **ficticia** `entradas123`:

| ID | Correo | Rol |
|---|---|---|
| u-cli-1 | cliente@entradasya.bo | customer |
| u-cli-2 | andrea.vargas@entradasya.bo | customer |
| u-cli-3 | lfpaz@entradasya.bo | customer |
| u-org-1 | organizador@entradasya.bo | organizer |
| u-org-2 | valeria@productoraandes.bo | organizer |
| u-door-1 | portero@entradasya.bo | doorman |

Reiniciar pierde registros nuevos y restaura semillas. No hay logout backend, refresh token, /auth/me ni endpoint público para otorgar roles.

## Seguridad y estructura

- `users/`: repositorio en memoria, reserva de email antes del hash asíncrono para evitar duplicados concurrentes; copias defensivas.
- `auth/`: validación Zod, controller y servicio.
- `common/`: errores del contrato y filtro global, incluidos errores del parser JSON.
- `config/`: validación del entorno sin filtrar secretos en errores.
- `JwtSigner` y `PasswordHasher` oficiales de `@nestjs/authentication`, sin instalar guard global ni sesiones del paquete. Firma HS256; claims sub/name/email/role/iat/exp, más jti generado por el paquete.
- PasswordHasher usa scrypt asíncrono con sal aleatoria y parámetros por defecto del paquete (logN=17). NFKC es una normalización explícita y documentada del paquete. Pruebas usan logN=10 solo mediante override, no configuración de producción.
- Consumidores Go/Rust deberán validar firma, algoritmo, expiración y claims por su cuenta. Sus validadores y permisos aún no están implementados; emitir un JWT no prueba esa integración.
- Sin revocación persistente: un JWT puede seguir verificándose tras reinicio hasta expirar. Sin rate limiting productivo en esta demo.

## Verificación

```sh
bun run build
bun run lint
bun run test
bun run test:e2e
```

`test`: lógica, DI real, repositorio, JWT y router Express en memoria usando streams Node (sin puerto). `test:e2e`: Supertest con servidor HTTP real y puerto efímero; requiere permiso para abrir sockets. No son equivalentes. El entorno del agente restringe listen con EPERM; por eso no se declara que E2E real pase aquí.

79 pruebas de lógica/router y E2E del servicio autónomo. Se cubren claims y roles, registro concurrente, validación, respuestas de error, JSON malformado, firma/expiración/algoritmo, protección de hashes y configuración.
