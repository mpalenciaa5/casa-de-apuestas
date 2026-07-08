import { MongoClient } from 'mongodb';
import dns from 'dns';

const uri = process.env.MONGODB_URI;
const options = {
  connectTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000,
  tlsAllowInvalidCertificates: true, // Safeguard against outdated local CA certificates or SSL inspection proxies
};

let clientPromise;

/**
 * Manually queries public DNS to resolve MongoDB Atlas SRV records.
 * Reconstructs a standard mongodb:// multi-host connection string.
 * This bypasses local network blocks on DNS SRV records.
 */
async function resolveAndReconstructUri(originalUri) {
  if (!originalUri || !originalUri.startsWith('mongodb+srv://')) {
    return originalUri;
  }

  try {
    console.log('[DNS Bypass] Intentando resolver SRV mediante DNS público (8.8.8.8 / 1.1.1.1)...');
    
    // Force Node's DNS resolver to use public DNS servers for this query
    dns.setServers(['8.8.8.8', '1.1.1.1']);

    // Parse URI components: mongodb+srv://<user>:<password>@<host>/<database>?<options>
    const match = originalUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^/]+)\/?([^?]*)/);
    if (!match) {
      console.warn('[DNS Bypass Warning] No se pudo parsear el formato de la URI. Se usará la original.');
      return originalUri;
    }

    const [, username, password, hostAndPath, dbNameAndQuery] = match;
    console.log(`[DNS Bypass Debug] Credenciales leídas -> Usuario: "${username}", Contraseña (primeros 3 cat.): "${password.substring(0, 3)}...", Longitud: ${password.length}`);
    const host = hostAndPath.split('/')[0];
    
    // Resolve the SRV records for the cluster
    const srvRecords = await new Promise((resolve, reject) => {
      dns.resolveSrv(`_mongodb._tcp.${host}`, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });

    if (!srvRecords || srvRecords.length === 0) {
      throw new Error('No se devolvieron registros SRV.');
    }

    // Map list of hosts
    const hostsList = srvRecords.map(r => `${r.name}:${r.port}`).join(',');
    
    // Extract DB name (defaults to 'casa-apuestas')
    const dbName = dbNameAndQuery.split('?')[0] || 'casa-apuestas';
    
    // Reconstruct connection string as standard mongodb:// protocol
    const reconstructed = `mongodb://${username}:${password}@${hostsList}/${dbName}?ssl=true&authSource=admin&appName=Cluster0`;
    
    console.log('[DNS Bypass] Clúster resuelto exitosamente. Nodos identificados:', srvRecords.map(r => r.name));
    return reconstructed;
  } catch (err) {
    console.warn('[DNS Bypass Warning] Falló la resolución manual del DNS. Detalle:', err.message);
    console.warn('[DNS Bypass Warning] Se intentará conectar utilizando el driver por defecto.');
    return originalUri;
  }
}

export async function getNoSQLDB() {
  if (!uri) {
    console.warn("WARNING: MONGODB_URI no está configurada.");
    throw new Error("MONGODB_URI no está configurada. Por favor, crea un archivo .env.local y define MONGODB_URI con tu conexión de MongoDB Atlas.");
  }

  // dev global connection caching to support Next.js hot-reloads
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = (async () => {
        const finalUri = await resolveAndReconstructUri(uri);
        console.log('[NoSQL Connection] Conectando a MongoDB Atlas en segundo plano...');
        const client = new MongoClient(finalUri, options);
        return client.connect();
      })();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // production mode
    if (!clientPromise) {
      clientPromise = (async () => {
        console.log('[NoSQL Connection] Conectando a MongoDB Atlas de forma directa...');
        const client = new MongoClient(uri, options);
        return client.connect();
      })();
    }
  }

  const conn = await clientPromise;
  return conn.db();
}
