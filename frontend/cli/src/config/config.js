import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  // API URLs
  authApiUrl: (process.env.AUTH_API_URL || 'http://localhost:8000').replace(/\/$/, ''),
  musicApiUrl: (process.env.MUSIC_API_URL || 'http://localhost:8081').replace(/\/$/, ''),
  wsApiUrl: (process.env.WS_API_URL || 'ws://localhost:8081').replace(/\/$/, ''),
  
  // CLI settings
  debug: process.env.CLI_DEBUG === 'true',
  
  // Session file
  sessionFile: join(__dirname, '../../.session.json'),
};

// Made with Bob
