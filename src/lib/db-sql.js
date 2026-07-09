import mysql from 'mysql2/promise';

// Cache database connection globally to prevent multiple connections in dev hot-reloads
let globalRef = global;

// In-Memory Database Contingency Store (100% JS compatible, compiles successfully on Vercel)
if (!globalRef.memoryDbStore) {
  globalRef.memoryDbStore = {
    users: [
      {
        id: 1,
        username: 'admin',
        email: 'miguelalejandropalenciaalonzo@gmail.com',
        password_hash: 'google_oauth_blocked_admin',
        balance: 1000.0,
        role: 'admin',
        dpi: '1000123456789',
        bank_account: 'GT-BANK-ADMIN',
        birth_date: '2000-01-01'
      }
    ],
    bets: [],
    transactions: []
  };
}

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
        console.error('[SQL Fallback Alert] Falló conexión a MySQL. Iniciando base de datos en memoria para presentación...', err);
        
        // Adaptador de compatibilidad en memoria JS (sin módulos C++ nativos)
        const memoryDb = {
          async run(sql, params = []) {
            const sqlUpper = sql.toUpperCase();
            if (sqlUpper.includes('INSERT INTO USERS')) {
              // Params order: username, email, password_hash, role, balance, dpi, bank_account, birth_date
              const id = globalRef.memoryDbStore.users.length + 1;
              const newUser = {
                id,
                username: params[0],
                email: params[1],
                password_hash: params[2],
                role: params[3],
                balance: params[4] || 100.0,
                dpi: params[5],
                bank_account: params[6],
                birth_date: params[7]
              };
              globalRef.memoryDbStore.users.push(newUser);
              return { lastID: id, changes: 1 };
            }

            if (sqlUpper.includes('INSERT INTO BETS')) {
              const id = globalRef.memoryDbStore.bets.length + 1;
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
                status: 'pending'
              };
              globalRef.memoryDbStore.bets.push(newBet);
              // Deduct balance from memory user
              const u = globalRef.memoryDbStore.users.find(x => x.id === params[0]);
              if (u) u.balance -= params[7];
              return { lastID: id, changes: 1 };
            }

            if (sqlUpper.includes('INSERT INTO TRANSACTIONS')) {
              const id = globalRef.memoryDbStore.transactions.length + 1;
              const newTx = {
                id,
                user_id: params[0],
                type: params[1],
                amount: params[2]
              };
              globalRef.memoryDbStore.transactions.push(newTx);
              // Update user balance
              const u = globalRef.memoryDbStore.users.find(x => x.id === params[0]);
              if (u) {
                if (params[1] === 'deposit') u.balance += params[2];
                else u.balance -= params[2];
              }
              return { lastID: id, changes: 1 };
            }

            if (sqlUpper.includes('UPDATE USERS SET ROLE')) {
              // role, id
              const u = globalRef.memoryDbStore.users.find(x => x.id === params[1]);
              if (u) u.role = params[0];
              return { lastID: null, changes: 1 };
            }

            if (sqlUpper.includes('UPDATE USERS SET BALANCE')) {
              // balance, id
              const u = globalRef.memoryDbStore.users.find(x => x.id === params[1]);
              if (u) u.balance = params[0];
              return { lastID: null, changes: 1 };
            }

            return { lastID: null, changes: 0 };
          },

          async all(sql, params = []) {
            const sqlUpper = sql.toUpperCase();
            if (sqlUpper.includes('FROM BETS')) {
              if (params[0]) {
                return globalRef.memoryDbStore.bets.filter(b => b.user_id === params[0]);
              }
              return globalRef.memoryDbStore.bets;
            }
            if (sqlUpper.includes('FROM TRANSACTIONS')) {
              if (params[0]) {
                return globalRef.memoryDbStore.transactions.filter(t => t.user_id === params[0]);
              }
              return globalRef.memoryDbStore.transactions;
            }
            return [];
          },

          async get(sql, params = []) {
            const sqlUpper = sql.toUpperCase();
            if (sqlUpper.includes('FROM USERS WHERE EMAIL')) {
              return globalRef.memoryDbStore.users.find(u => u.email === params[0].toLowerCase().trim()) || null;
            }
            if (sqlUpper.includes('FROM USERS WHERE USERNAME')) {
              return globalRef.memoryDbStore.users.find(u => u.username === params[0]) || null;
            }
            if (sqlUpper.includes('FROM USERS WHERE ID')) {
              return globalRef.memoryDbStore.users.find(u => u.id === params[0]) || null;
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

        return memoryDb;
      }
    })();
  }
  return globalRef.dbPromise;
}
