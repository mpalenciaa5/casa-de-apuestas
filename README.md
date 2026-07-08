# ApexBet - Plataforma de Apuestas Deportivas (Proyecto Final)

**ApexBet** es una aplicación web moderna de simulación de apuestas deportivas, diseñada para demostrar el uso coordinado y funcional de bases de datos híbridas bajo la arquitectura Serverless, desplegada en Vercel.

Este proyecto ha sido desarrollado como **Proyecto Final**, implementando Next.js (App Router), Vanilla CSS, y conectando simultáneamente dos tipos de bases de datos bajo configuraciones locales y en la nube.

---

## 🚀 Requisitos del Proyecto Cumplidos
1. **Despliegue en Vercel**: Configurado con Next.js (App Router), optimizado de forma nativa para correr en la infraestructura de Vercel.
2. **2 Bases de Datos (SQL y NoSQL)**:
   - **SQL**: SQLite local, que almacena de forma estructurada los usuarios, balances financieros y apuestas relacionales.
   - **NoSQL**: MongoDB Atlas en la nube, que maneja el catálogo flexible de encuentros deportivos y el registro detallado de logs de auditoría.
3. **1 Base Local y 1 en la Nube**:
   - **Local**: SQLite (`local.db` en la raíz del proyecto), libre de complejas instalaciones locales para simplificar la ejecución inmediata en cualquier ordenador.
   - **Nube**: MongoDB Atlas Cloud, accesible mediante cadena de conexión segura en la nube.

---

## 📐 Arquitectura de Datos e Integración

El sistema utiliza cada motor de base de datos según sus fortalezas de ingeniería de software:

```mermaid
flowchart TD
    Client(Cliente Web - React) <--> API(API Routes - Next.js)
    
    subgraph Base SQL Local
        API <-->|Transacciones ACID / Relacional| SQLite[(SQLite: local.db)]
    end

    subgraph Base NoSQL Nube
        API <-->|Documentos / Flexible| MongoDB[(MongoDB Atlas Cloud)]
    end
```

### 1. SQLite (SQL Relacional Local)
Almacena información transaccional crítica que requiere integridad referencial, transacciones ACID y consistencia estricta:
*   **users**: Almacena credenciales de usuario, correos únicos y balances monetarios virtuales.
*   **bets**: Registra apuestas individuales vinculadas a los usuarios mediante llaves foráneas (`user_id`). Cada apuesta contiene el equipo seleccionado, la cuota fijada, el monto y el estado (`pen*   **transactions**: Historial financiero que detalla depósitos, retiros y cobros de apuestas para auditoría matemática estricta. Almacena también las transacciones de juego del casino (`casino_slots_win`, `casino_slots_loss`, `casino_roulette_win`, `casino_roulette_loss`).

### 2. MongoDB Atlas (NoSQL Documental en la Nube)
Almacena colecciones flexibles con esquemas dinámicos para datos no estructurados o de alta frecuencia de escritura:
*   **matches**: Catálogo de partidos (Fútbol, Baloncesto, Tenis, E-Sports). Permite almacenar detalles variables y jerárquicos (por ejemplo, estadios para fútbol, canchas y superficies para tenis, ligas o fases del torneo) en forma de sub-documentos flexibles sin alterar la estructura general.
*   **activity_logs**: Registro de auditoría del usuario (inicios de sesión, registros, colocación de apuestas, cobros, depósitos). Utiliza la estructura flexible de NoSQL para guardar metadatos variables según la acción ejecutada (como los rodillos resultantes del tragamonedas o la cuota/color de la ruleta).

---

## 🛠️ Instalación y Configuración Local

Sigue estos sencillos pasos para iniciar y presentar tu proyecto localmente:

### 1. Requisitos Previos
*   **Node.js**: Versión 18 o superior (probado con éxito en v24.15.0).
*   **npm**: Gestor de paquetes incluido con Node.js.

### 2. Clonar / Extraer el Proyecto
Asegúrate de que todos los archivos estén ubicados en la carpeta de tu espacio de trabajo.

### 3. Instalar Dependencias
Abre una terminal en el directorio raíz del proyecto y ejecuta:
```bash
npm install
```

### 4. Configurar las Variables de Entorno
1.  Duplica el archivo `.env.local.example` y renombralo como `.env.local`:
    ```bash
    cp .env.local.example .env.local
    ```
2.  Abre `.env.local` y configura tu enlace de conexión de **MongoDB Atlas**:
    *   Crea un Cluster gratis en [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
    *   Crea una base de datos llamada `casa-apuestas`.
    *   Copia la URL de conexión en `MONGODB_URI`, ingresando tu usuario y contraseña.
    *   *Ejemplo*: `MONGODB_URI=mongodb+srv://admin:miPassword123@cluster0.abcde.mongodb.net/casa-apuestas?retryWrites=true&w=majority`
3.  Define una clave secreta para la sesión en `JWT_SECRET`.

---

## 🏃‍♂️ Ejecutar la Aplicación

Inicia el servidor de desarrollo local:
```bash
npm run dev
```
Abre tu navegador en [http://localhost:3000](http://localhost:3000).

*Nota: La primera vez que entres a la cartelera de apuestas, la aplicación detectará que MongoDB está vacío y sembrará automáticamente 5 partidos de fútbol, baloncesto, tenis y e-sports como datos de demostración.*

---

## 🎯 Guión para la Presentación / Demo del Proyecto

Para impresionar a tu jurado, sigue este flujo de demostración de punta a punta:

1.  **Explorar Deportes (NoSQL Nube)**:
    *   Navega en la página de inicio. Muestra la cartelera deportiva filtrando por disciplinas y destaca las cuotas cambiantes en vivo (indicadores ▲/▼ con bordes verdes/rojos). Explica al profesor que esos partidos están cargándose dinámicamente desde **MongoDB Atlas en la nube**.
2.  **Registro e Integridad SQL (SQL Local)**:
    *   Haz clic en "Registrarse" y crea una nueva cuenta.
    *   Explica que esta acción insertó un nuevo registro en la tabla `users` de **SQLite local** con un saldo inicial de `$1,000.00` y al mismo tiempo generó un documento de registro en el log de **MongoDB Atlas**.
3.  **Realizar una Apuesta (Integración de Transacciones)**:
    *   Selecciona un partido (Ej. *Real Madrid vs FC Barcelona*, cuota @1.95 local).
    *   En la boleta de apuestas lateral, ingresa `$100.00`.
    *   Haz clic en **Colocar Apuesta**.
    *   **Puntos Técnicos a Destacar**:
        *   Se ejecuta una transacción atómica en SQLite: se resta `$100` al usuario, se inserta una fila en la tabla `bets` con estado `pending`, y se guarda el recibo en la tabla `transactions`.
        *   Simultáneamente, se graba el log flexible de la apuesta en MongoDB Atlas Cloud.
4.  **Depositar y Retirar Fondos**:
    *   Ve a **Dashboard / Wallet**. Muestra el historial relacional de tus apuestas y la tabla de logs de MongoDB.
    *   Realiza un depósito de `$500` y muestra cómo el saldo se actualiza instantáneamente en SQLite y escribe un log de auditoría en la nube.
5.  **Cierre de Partido y Pago de Cuotas (El Loop Completo)**:
    *   Ve a la **Consola Admin**.
    *   Simula la finalización del partido en el que apostaste (Ej. ingresa marcador `3 - 1` a favor del local).
    *   Haz clic en **Cerrar y Liquidar Apuestas**.
    *   **Puntos Técnicos a Destacar**:
        *   El partido cambia su estado a `finished` en MongoDB.
        *   El backend busca las apuestas pendientes para ese ID en SQLite.
        *   Se corre una transacción SQL: se evalúa el pronóstico de los usuarios, se marca la apuesta como `won` (ganada) o `lost` (perdida), y si el usuario acertó, se acredita su premio (Ej. `$100 * @1.95 = $195.00`) directamente a su balance SQL.
        *   Se registran logs finales en la nube.
    *   Vuelve a tu dashboard y muestra tu balance actualizado y tu apuesta marcada con estado **GANADA**.
6.  **Juegos de Casino Interactivos (CSS Avanzado + Flujo Híbrido)**:
    *   Haz clic en **Casino** en el menú superior.
    *   **Pestaña Tragamonedas**: Selecciona una apuesta y gira los rodillos. Explica que los rodillos giran y se detienen uno por uno de manera independiente (staggered delay). Si consigues una combinación ganadora, muestra cómo se suma a tu saldo en SQLite y cómo MongoDB almacena el documento con el resultado exacto (ej. `[🍒, 💎, 🍒]`).
    *   **Pestaña Ruleta**: Elige una apuesta (ej. apostar al Rojo o a un número en particular) y gira la rueda. Destaca el diseño circular receptivo de 37 casilleros y cómo gira la rueda frenando de forma orgánica en la celda ganadora exacta. Muestra que la ganancia (ej. 2x para Rojo o 35x para número exacto/cero verde) impacta directamente en SQLite y reporta el log completo en la nube.
    *   Vuelve al **Dashboard / Wallet** y muestra la lista de transacciones donde aparecerán tus tiradas de slots y giros de ruleta junto a los BSON IDs de MongoDB Atlas.
