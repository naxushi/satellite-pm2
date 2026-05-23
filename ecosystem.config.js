module.exports = {
  apps: [
    {
      name: 'orientation',
      script: './modules/orientation/index.js',
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '150M',
      error_file: './logs/orientation-error.log',
      out_file: './logs/orientation-out.log',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'command-module',
      script: './modules/command-module/index.js',
      instances: 1,
      max_memory_restart: '200M',
      error_file: './logs/command-error.log',
      out_file: './logs/command-out.log',
      env: { PORT: 3000 }
    },
    {
      name: 'scheduler',
      script: './modules/scheduler/index.js',
      instances: 1,
      kill_timeout: 10000,
      error_file: './logs/scheduler-error.log',
      out_file: './logs/scheduler-out.log'
    },
    {
      name: 'telemetry',
      script: './modules/telemetry/index.js',
      instances: 1,
      error_file: './logs/telemetry-error.log',
      out_file: './logs/telemetry-out.log'
    },
    {
      name: 'photo-simulator',
      script: './modules/photo-simulator/index.js',
      instances: 1,
      max_restarts: 5,
      min_uptime: 5000,
      error_file: './logs/photo-error.log'
    }
  ]
};