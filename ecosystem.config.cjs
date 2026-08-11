module.exports = {
  apps: [{
    name: '0mar-lol',
    cwd: '/srv/apps/0mar-lol',
    script: 'npm',
    args: 'run start',
    autorestart: true,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: '3100',
      HOSTNAME: '127.0.0.1',
      NEXT_TELEMETRY_DISABLED: '1'
    }
  }]
};
