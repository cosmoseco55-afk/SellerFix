# Deploy SallerFix to 187.77.141.217

## 1. Set DNS in REG.RU

Use the records from `deploy/DNS_REG_RU.md`.

## 2. Copy files to the server

From this project folder:

```bash
scp sallerfix.ru-static.zip root@187.77.141.217:/tmp/sallerfix.ru-static.zip
scp deploy/install-server.sh root@187.77.141.217:/tmp/install-server.sh
```

## 3. Install on server

```bash
ssh root@187.77.141.217
sudo bash /tmp/install-server.sh
```

## 4. Enable HTTPS

After DNS resolves to `187.77.141.217`:

```bash
sudo certbot --nginx -d sallerfix.ru -d www.sallerfix.ru
```

## 5. Verify

```bash
curl -I http://sallerfix.ru
curl -I https://sallerfix.ru
```

## 6. CSP maintenance (already applied on prod)

Log rotation:

```text
/etc/logrotate.d/sallerfix-csp
```

Daily CSP report:

```text
/usr/local/bin/sallerfix-csp-daily-report.sh
```

Systemd timer:

```bash
systemctl status sallerfix-csp-report.timer
cat /var/log/sallerfix-csp/daily-summary.log
```
