import mysql from 'mysql2/promise';

// Cache database connection globally to prevent multiple connections in dev hot-reloads
let globalRef = global;

export async function getSQLDB() {
  if (!globalRef.dbPromise) {
    const host = process.env.MYSQL_HOST || 'localhost';
    const port = parseInt(process.env.MYSQL_PORT || '3306');
    const user = process.env.MYSQL_USER || 'root';
    const password = process.env.MYSQL_PASSWORD === 'tu_contraseña_aqui' ? '' : (process.env.MYSQL_PASSWORD || '');
    const database = process.env.MYSQL_DATABASE || 'casa_apuestas';

    // Aiven requires SSL mode. Check if we are running in cloud or locally.
    // Standard local MySQL usually doesn't mandate SSL. Aiven hosts end in .aivencloud.com.
    const isCloud = host.includes('aivencloud.com') || host.includes('database') || process.env.NODE_ENV === 'production';
    const sslOptions = isCloud ? { rejectUnauthorized: false } : null;

    globalRef.dbPromise = (async () => {
      try {
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
          // Wrapper for SQL execution (exec/run/all/get)
          async run(sql, params = []) {
            const formattedSql = sql.replace(/BEGIN TRANSACTION/i, 'START TRANSACTION');
            const [result] = await pool.execute(formattedSql, params);
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
              await pool.query(statement);
            }
          },
          async configure(option, value) {
            return;
          }
        };

        return dbWrapper;

      } catch (err) {
        console.error('Failed to connect to MySQL database:', err);
        throw err;
      }
    })();
  }
  return globalRef.dbPromise;
}
