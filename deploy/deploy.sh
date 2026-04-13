#!/bin/bash
set -e

cd /opt/mirror
git pull
npm install --production
sudo systemctl restart mirror-server

echo "Deploy complete. Checking status..."
sudo systemctl status mirror-server --no-pager
