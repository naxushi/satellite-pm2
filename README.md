#  Отказоустойчивая бортовая система спутника на PM2

##  Быстрый старт

```bash
git clone <repo>
cd satellite-pm2

# 1. Установка зависимостей
npm run install-all

# 2. Убедитесь что Redis запущен
redis-server

# 3. Запуск всех модулей через PM2
npm run start

# 4. Открыть веб-пульт
http://localhost:3000