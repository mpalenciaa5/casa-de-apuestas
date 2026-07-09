import mysql from 'mysql2/promise';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

// Cache database connection globally to prevent multiple connections in dev hot-reloads
let globalRef = global;

export async function getSQLDB() {
  if (!globalRef.dbPromise) {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = parseInt(process.env.MYSQL_PORT || '3306');
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD === 'tu_contraseña_aqui' ? '' : (process.env.MYSQL_PASSWORD || '');
    const database = process.env.MYSQL_DATABASE || 'casa_apuestas';

    const isCloud = host.includes('aivencloud.com') || host.includes('database') || process.env.NODE_ENV === 'production';
    const sslOptions = isCloud ? { rejectUnauthorized: false } : null;

    globalRef.dbPromise = (async () => {
      try {
        console.log(`[SQL Connect] Intentando conectar a MySQL Host: ${host}:${port}...`);
        
        // 1. First connect without database selection to ensure the DB exists
        const initConnection = await mysql.createConnection({
          host,
          port,
          user,
          password,
          ssl: sslOptions
        });

        await initConnection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
        await initConnection.end();

        // 2. Connect to the target database
        const pool = mysql.createPool({
          host,
          port,
          user,
          password,
          database,
          ssl: sslOptions,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0
        });

        console.log('MySQL Connection Pool created successfully.');

        // 3. Run schema creation
        const connection = await pool.getConnection();
        try {
          await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              username VARCHAR(255) UNIQUE NOT NULL,
              email VARCHAR(255) UNIQUE NOT NULL,
              password_hash VARCHAR(255) NOT NULL,
              balance DOUBLE DEFAULT 100.0,
              role VARCHAR(50) DEFAULT 'user',
              dpi VARCHAR(100),
              bank_account VARCHAR(255),
              birth_date VARCHAR(100),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
          `);

          await connection.query(`
            CREATE TABLE IF NOT EXISTS bets (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              match_id VARCHAR(255) NOT NULL,
              sport VARCHAR(100) NOT NULL,
              home_team VARCHAR(255) NOT NULL,
              away_team VARCHAR(255) NOT NULL,
              selected_outcome VARCHAR(50) NOT NULL,
              odds DOUBLE NOT NULL,
              amount DOUBLE NOT NULL,
              potential_payout DOUBLE NOT NULL,
              status VARCHAR(50) DEFAULT 'pending',
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
          `);

          await connection.query(`
            CREATE TABLE IF NOT EXISTS transactions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              type VARCHAR(100) NOT NULL,
              amount DOUBLE NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB;
          `);

          console.log('MySQL schema verified / created successfully.');
        } finally {
          connection.release();
        }

        // 4. Wrap the pool in a compatibility layer to mimic SQLite's API
        const dbWrapper = {
          async run(sql, params = []) {
            const isTransactionCmd = /^(BEGIN TRANSACTION|START TRANSACTION|COMMIT|ROLLBACK)$/i.test(sql.trim());
            if (isTransactionCmd) {
              try {
                if (/ROLLBACK/i.test(sql)) {
                  await pool.query(sql);
                } else if (/BEGIN|START/i.test(sql)) {
                  await pool.query('START TRANSACTION');
                } else {
                  await pool.query(sql);
                }
              } catch (e) {}
              return { lastID: null, changes: 0 };
            }

            const [result] = await pool.execute(sql, params);
            return {
              lastID: result.insertId || null,
              changes: result.affectedRows || 0
            };
          },
          async all(sql, params = []) {
            const [rows] = await pool.execute(sql, params);
            return rows;
          },
          async get(sql, params = []) {
            const [rows] = await pool.execute(sql, params);
            return rows[0] || null;
          },
          async exec(sql) {
            const statements = sql
              .split(';')
              .map(s => s.trim())
              .filter(s => s.length > 0);
            for (const statement of statements) {
              const isTransactionCmd = /^(BEGIN TRANSACTION|START TRANSACTION|COMMIT|ROLLBACK)$/i.test(statement);
              if (isTransactionCmd) continue;
              await pool.query(statement);
            }
          },
          async configure(option, value) {
            return;
          }
        };

        return dbWrapper;

      } catch (err) {
        console.error('[SQL Fallback Alert] Falló la conexión a MySQL (Aiven). Iniciando SQLite local de contingencia...', err);
        
        // Determinar ruta de base de datos local (/tmp es escribible en Vercel Serverless)
        const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
        const dbPath = isVercel 
          ? path.join('/tmp', 'casa_apuestas.db') 
          : path.join(process.cwd(), 'casa_apuestas.db');

        console.log(`[SQL Contingency] Abriendo SQLite en: ${dbPath}`);

        const sqliteDb = await open({
          filename: dbPath,
          driver: sqlite3.Database
        });

        // Habilitar Foreign Keys en SQLite
        await sqliteDb.run('PRAGMA foreign_keys = ON;');

        // Inicializar esquema SQLite
        await sqliteDb.exec(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            balance REAL DEFAULT 100.0,
            role TEXT DEFAULT 'user',
            dpi TEXT,
            bank_account TEXT,
            birth_date TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS bets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            match_id TEXT NOT NULL,
            sport TEXT NOT NULL,
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            selected_outcome TEXT NOT NULL,
            odds REAL NOT NULL,
            amount REAL NOT NULL,
            potential_payout REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );

          CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
          );
        `);

        console.log('[SQL Contingency] Esquema SQLite de contingencia inicializado.');

        // Devolver wrapper compatible con SQLite de forma directa
        return sqliteDb;
      }
    })();
  }
  return globalRef.dbPromise;
}
