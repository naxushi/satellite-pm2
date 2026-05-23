@echo off
cd ../../
start cmd /k "redis-server"
timeout /t 3
start cmd /k "npm run start"
start "" http://localhost:3000