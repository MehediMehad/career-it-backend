import type { Server as HttpServer } from 'http';

import app from './app';
import { getLocalIP } from './app/helpers/devHelpers';
import seedSuperAdmin from './app/libs/seedSuperAdmin';
import { initializeSocket } from './app/libs/socket';
import config from './configs';

let server: HttpServer;

async function main() {
  try {
    // 🟢 Start the server
    const port = config.app.port || 5000;
    server = app.listen(port, async () => {
      console.log(`🚀 Server is running on port ${port}`);
      await seedSuperAdmin(); // Seed Super Admin user on startup
      getLocalIP(); // 🖥️ Your PC's local IPv4 address(es)

      // Initialize Socket.IO
      const io = initializeSocket(server);
      global.io = io;
      console.log('✅ Socket.io initialized');
    });

    // 🔐 Handle Uncaught Exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      shutdown();
    });

    // 🔐 Handle Unhandled Promise Rejections
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled Rejection:', reason);
      shutdown();
    });

    // 🛑 Graceful Shutdown
    process.on('SIGTERM', () => {
      console.info('🔁 SIGTERM received.');
      shutdown();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// 🔁 Graceful Server Shutdown
function shutdown() {
  if (server) {
    server.close(() => {
      console.info('🔒 Server closed gracefully.');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
}

main();
