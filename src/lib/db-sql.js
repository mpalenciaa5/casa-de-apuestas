import mysql from 'mysql2/promise';
import { getNoSQLDB } from './db-nosql';

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
        console.error('[SQL Fallback Alert] Falló conexión a MySQL. Iniciando base de datos persistente en MongoDB Atlas...', err);
        
        // Conexión a MongoDB Atlas para persistir de manera real los datos de contingencia
        const mongoDb = await getNoSQLDB();

        const mongoDbWrapper = {
          async run(sql, params = []) {
            const sqlUpper = sql.toUpperCase();
            
            if (sqlUpper.includes('INSERT INTO USERS')) {
              // Params: username, email, password_hash, role, balance, dpi, bank_account, birth_date
              // Buscamos un ID secuencial autoincrementable para simular SQL
              const count = await mongoDb.collection('fallback_users').countDocuments();
              const id = count + 1;
              
              const newUser = {
                id,
                username: params[0],
                email: params[1].toLowerCase().trim(),
                password_hash: params[2],
                role: params[3],
                balance: params[4] !== undefined ? params[4] : 100.0,
                dpi: params[5],
                bank_account: params[6],
                birth_date: params[7],
                created_at: new Date()
              };

              await mongoDb.collection('fallback_users').insertOne(newUser);
              return { lastID: id, changes: 1 };
            }

            if (sqlUpper.includes('INSERT INTO BETS')) {
              // Params: user_id, match_id, sport, home_team, away_team, selected_outcome, odds, amount, potential_payout
              const count = await mongoDb.collection('fallback_bets').countDocuments();
              const id = count + 1;

              const newBet = {
                id,
                user_id: params[0],
                match_id: params[1],
                sport: params[2],
                home_team: params[3],
                away_team: params[4],
                selected_outcome: params[5],
                odds: params[6],
                amount: params[7],
                potential_payout: params[8],
                status: 'pending',
                created_at: new Date()
              };

              await mongoDb.collection('fallback_bets').insertOne(newBet);
              
              // Descontar saldo del usuario en MongoDB
              await mongoDb.collection('fallback_users').updateOne(
                { id: params[0] },
                { $inc: { balance: -params[7] } }
              );

              return { lastID: id, changes: 1 };
            }

            if (sqlUpper.includes('INSERT INTO TRANSACTIONS')) {
              // Params: user_id, type, amount
              const count = await mongoDb.collection('fallback_transactions').countDocuments();
              const id = count + 1;

              const newTx = {
                id,
                user_id: params[0],
                type: params[1],
                amount: params[2],
                created_at: new Date()
              };

              await mongoDb.collection('fallback_transactions').insertOne(newTx);

              // Actualizar balance del usuario en MongoDB
              const amountChange = params[1] === 'deposit' ? params[2] : params[2];
              await mongoDb.collection('fallback_users').updateOne(
                { id: params[0] },
                { $inc: { balance: amountChange } }
              );

              return { lastID: id, changes: 1 };
            }

            if (sqlUpper.includes('UPDATE USERS SET ROLE')) {
              // Params: role, id
              await mongoDb.collection('fallback_users').updateOne(
                { id: params[1] },
                { $set: { role: params[0] } }
              );
              return { lastID: null, changes: 1 };
            }

            if (sqlUpper.includes('UPDATE USERS SET BALANCE')) {
              // Params: balance, id
              await mongoDb.collection('fallback_users').updateOne(
                { id: params[1] },
                { $set: { balance: params[0] } }
              );
              return { lastID: null, changes: 1 };
            }

            return { lastID: null, changes: 0 };
          },

          async all(sql, params = []) {
            const sqlUpper = sql.toUpperCase();
            
            if (sqlUpper.includes('FROM BETS')) {
              const query = params[0] ? { user_id: params[0] } : {};
              const list = await mongoDb.collection('fallback_bets').find(query).sort({ created_at: -1 }).toArray();
              return list;
            }

            if (sqlUpper.includes('FROM TRANSACTIONS')) {
              const query = params[0] ? { user_id: params[0] } : {};
              const list = await mongoDb.collection('fallback_transactions').find(query).sort({ created_at: -1 }).toArray();
              return list;
            }

            return [];
          },

          async get(sql, params = []) {
            const sqlUpper = sql.toUpperCase();

            if (sqlUpper.includes('FROM USERS WHERE EMAIL')) {
              const emailClean = params[0].toLowerCase().trim();
              const u = await mongoDb.collection('fallback_users').findOne({ email: emailClean });
              if (u && u.email === 'miguelalejandropalenciaalonzo@gmail.com') {
                u.balance = 100000.0; // Saldo de prueba ilimitado para demostración del admin
              }
              return u || null;
            }

            if (sqlUpper.includes('FROM USERS WHERE USERNAME')) {
              const u = await mongoDb.collection('fallback_users').findOne({ username: params[0] });
              if (u && u.email === 'miguelalejandropalenciaalonzo@gmail.com') {
                u.balance = 100000.0;
              }
              return u || null;
            }

            if (sqlUpper.includes('FROM USERS WHERE ID')) {
              const u = await mongoDb.collection('fallback_users').findOne({ id: params[0] });
              if (u && u.email === 'miguelalejandropalenciaalonzo@gmail.com') {
                u.balance = 100000.0;
              }
              return u || null;
            }

            return null;
          },

          async exec(sql) {
            return;
          },
          async configure(option, value) {
            return;
          }
        };

        return mongoDbWrapper;
      }
    })();
  }
  return globalRef.dbPromise;
}
