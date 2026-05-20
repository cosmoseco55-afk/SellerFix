# SallerFix deployment on REG.RU

## Files to upload

Upload the contents of this folder to the site root on REG.RU hosting, usually:

```text
public_html/
```

Required files:

```text
index.html
styles.css
app.js
assets/sallerfix-logo.png
```

## DNS

If REG.RU hosting is used, set the domain to REG.RU hosting in the REG.RU control panel.

If DNS records are edited manually, add:

```text
@    A      <hosting server IP>
www  CNAME  sallerfix.ru.
```

After DNS propagation, open:

```text
https://sallerfix.ru
https://www.sallerfix.ru
```

## Notes

This is currently a static frontend prototype. Settings and imported operations are stored in the browser localStorage.
