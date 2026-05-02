# MySQL backup & restore

## Automatic backups

### Linux (cron)

```bash
chmod +x scripts/backup-db.sh
crontab -e
# Daily 02:00 server time
0 2 * * * /var/www/your-app/scripts/backup-db.sh >> /var/log/sarkari-db-backup.log 2>&1
```

Ensure `.env` on the server contains `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`.

### Windows (Task Scheduler)

1. Action: Start a program  
   - Program: `powershell.exe`  
   - Arguments: `-ExecutionPolicy Bypass -File "C:\path\to\project\scripts\backup-db.ps1"`
2. Schedule: daily (e.g. 02:00).
3. Install MySQL client tools so `mysqldump` is on `PATH`.

Backups are written under `backups/mysql/*.sql`.

### Retention

Rotate old files (example — keep 14 days):

```bash
find /var/www/your-app/backups/mysql -name "*.sql" -mtime +14 -delete
```

## Restore (emergency)

**Warning:** This overwrites the target database. Test on a copy first.

```bash
mysql -h DB_HOST -u DB_USER -p DB_NAME < backups/mysql/jobportal_YYYYMMDD_HHMMSS.sql
```

On Windows (PowerShell):

```powershell
$env:MYSQL_PWD = "your_password"
mysql -h 127.0.0.1 -u root your_db_name < .\backups\mysql\your_file.sql
```

After restore, restart the app (`pm2 reload` or your process manager) and verify `/ready`.

## Off-site copies

Copy `backups/mysql/` to S3, Backblaze, or another VPS (encrypted). A database dump is sensitive — treat it like production credentials.
