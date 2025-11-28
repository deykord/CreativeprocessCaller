#!/bin/bash

# Build and deploy script for CreativeprocessCaller

echo "🔨 Building frontend..."
npm run build

if [ $? -eq 0 ]; then
  echo "✓ Build successful"
  
  echo "📦 Copying dist to nginx..."
  cp -r dist/* /var/www/salescallagent.my/
  
  echo "🔄 Reloading nginx..."
  nginx -s reload
  
  echo "🚀 Restarting PM2 services..."
  pm2 restart all
  
  echo "✓ Deployment complete!"
  pm2 status
else
  echo "✗ Build failed"
  exit 1
fi
