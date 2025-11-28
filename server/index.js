require('dotenv').config();
const express = require('express');
const cors = require('cors');
const tokenRoutes = require('./routes/token');
const voiceRoutes = require('./routes/voice');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use('/api/token', tokenRoutes);
app.use('/api/voice', voiceRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.send({ status: 'ok', server: 'Creativeprocess.io Backend' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});