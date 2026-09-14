module.exports = {
  apps: [
    {
      name: 'despc',
      cwd: '/var/www/despc/backend',
      script: '/var/www/despc/backend/.venv/bin/uvicorn',
      args: 'app.main:app --host 127.0.0.1 --port 3006 --workers 2',
      interpreter: 'none',
      env: {
        DATABASE_URL: 'sqlite:////var/www/despc/backend/dsepc.db',
        FRONTEND_ORIGIN: '*',
      },
      restart_delay: 2000,
      max_memory_restart: '500M',
    },
  ],
}
