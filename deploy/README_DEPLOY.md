Deployment notes

PM2 (recommended for Node apps):

1. Install PM2 globally on your server:

   npm install -g pm2

2. Copy the repo to `/home/youruser/school-management-` and install deps:

   cd /home/youruser/school-management-
   npm install --production

3. Build frontend assets:

   npm run build

4. Start with PM2 using the provided ecosystem file:

   pm2 start deploy/ecosystem.config.js

5. Save PM2 process list and enable startup on reboot:

   pm2 save
   pm2 startup

Systemd (alternative):

1. Copy `deploy/edu-manage.service` to `/etc/systemd/system/edu-manage.service` and edit `WorkingDirectory` and `ExecStart` to match your environment.

2. Reload systemd and start the service:

   sudo systemctl daemon-reload
   sudo systemctl enable edu-manage.service
   sudo systemctl start edu-manage.service
   sudo journalctl -u edu-manage.service -f

Environment variables

Set the following environment variables for production in your process manager or systemd unit:

- `ST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (for OTP and support email delivery)
- `SUPPORT_EMAIL` (global fallback)
- `GMAIL_APP_PASJWT_SECRET` (required)
- `NODE_ENV=production`
- `SMTP_HOSWORD` (optional Gmail fallback when SMTP is unavailable)
- `CLOUDINARY_URL` (optional image upload provider)

Notes

- The app uses SQLite by default. Ensure the process user has write access to the workspace so the SQLite file can be created/updated.
- For scalable production, consider using a managed database and Cloudinary (set `CLOUDINARY_URL`) for image uploads.

