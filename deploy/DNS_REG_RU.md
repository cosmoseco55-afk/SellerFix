# DNS records for REG.RU

Point the domain to your server:

```text
@    A    187.77.141.217
www  A    187.77.141.217
```

Optional if REG.RU allows CNAME for `www`:

```text
www  CNAME  sallerfix.ru.
```

Do not use both `www A` and `www CNAME` at the same time.

After saving DNS records, propagation can take from a few minutes to several hours.

Check:

```bash
dig +short sallerfix.ru A
dig +short www.sallerfix.ru A
```

Expected:

```text
187.77.141.217
```
