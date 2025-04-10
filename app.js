require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const scrapeController = require('./controllers/scrapeController');

const app = express();
app.use(express.json());

// Middleware CORS (atur origin sesuai domain n8n Anda)
app.use(cors({
  origin: '*'
}));

// Middleware rate limit
app.use(rateLimit({
  windowMs: 1 * 60 * 1000, // 1 menit
  max: 30 // max 30 request per menit
}));

// Middleware API Key protection
app.use((req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// Endpoint scraping
app.post('/scrape', scrapeController.scrapeAndParse);

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Backend scraping API running on port ${PORT}`);
});
