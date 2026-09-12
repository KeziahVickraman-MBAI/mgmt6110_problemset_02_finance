import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

import companyHandler from './api/company.js';
import satelliteHandler from './api/satellite.js';
import newsHandler from './api/news.js';
import pricesHandler from './api/prices.js';
import healthHandler from './api/health.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount the 5 API handlers FIRST
  app.all('/api/company', (req, res) => companyHandler(req, res));
  app.all('/api/company.js', (req, res) => companyHandler(req, res));

  app.all('/api/satellite', (req, res) => satelliteHandler(req, res));
  app.all('/api/satellite.js', (req, res) => satelliteHandler(req, res));

  app.all('/api/news', (req, res) => newsHandler(req, res));
  app.all('/api/news.js', (req, res) => newsHandler(req, res));

  app.all('/api/prices', (req, res) => pricesHandler(req, res));
  app.all('/api/prices.js', (req, res) => pricesHandler(req, res));

  app.all('/api/health', (req, res) => healthHandler(req, res));
  app.all('/api/health.js', (req, res) => healthHandler(req, res));

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
