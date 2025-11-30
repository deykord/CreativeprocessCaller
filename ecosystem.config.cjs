module.exports = {
  apps: [
    {
      name: 'creativeprocess-backend',
      script: 'server.js',
      cwd: '/root/CreativeprocessCaller/server',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    },
    {
      name: 'creativeprocess-backend-dev',
      script: 'server.js',
      cwd: '/root/CreativeprocessCaller/server',
      env: {
        NODE_ENV: 'development',
        PORT: 3002
      }
    },
    {
      name: 'creativeprocess-frontend',
      script: 'npx',
      args: 'vite --port 5173',
      cwd: '/root/CreativeprocessCaller',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
