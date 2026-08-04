module.exports = {
  apps: [
    {
      name: 'edu-manage',
      script: 'server.js',
      cwd: __dirname + '/../',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
