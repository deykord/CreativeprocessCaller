const app = require('./app');
const config = require('./config/config');

app.listen(config.port, () => {
  console.log(`=================================`);
  console.log(`🚀 Creativeprocess.io Backend`);
  console.log(`🌍 Environment: ${config.env}`);
  console.log(`📡 Port: ${config.port}`);
  console.log(`=================================`);
});