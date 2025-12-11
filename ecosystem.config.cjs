module.exports = {
  apps: [
    {
      name: 'creativeprocess-backend',
      script: 'server.js',
      cwd: '/root/CreativeprocessCaller/server',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: 5000,
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
