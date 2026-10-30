#!/bin/sh
set -eu

# Trusted deployment input, never an incoming request header. Reject template syntax.
origin=${PUBLIC_ORIGIN:-}
fail() { printf '%s\n' 'PUBLIC_ORIGIN must be one HTTPS origin without credentials, path or wildcard' >&2; exit 1; }
[ -n "$origin" ] || fail
[ "$origin" = "$(printf '%s' "$origin" | tr -d '\r\n')" ] || fail
printf '%s\n' "$origin" | grep -Eq '^https://([a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?|\[[0-9a-fA-F:.]+\])(:[0-9]{1,5})?/?$' || fail
authority=${origin#https://}
authority=${authority%/}
host=$(printf '%s' "$authority" | sed 's/:[0-9][0-9]*$//')
if [ "$host" != "$authority" ]; then
    port=${authority##*:}
    [ "$port" -gt 0 ] && [ "$port" -le 65535 ] || fail
fi
sed "s/@YAIKU_PUBLIC_HOST@/$host/g" /etc/nginx/yaiku.conf.template > /tmp/yaiku-nginx.conf
exec "$@"
