#!/bin/sh
# Runs from nginx's /docker-entrypoint.d: copies VITE_ settings from the container environment into the app.
{
  printf 'globalThis.__CALENDAR_ENV__ = {'
  env | grep '^VITE_' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/^\([^=]*\)=\(.*\)$/"\1":"\2",/' | sed '$ s/,$//'
  printf '};\n'
} > /usr/share/nginx/html/runtime-env.js
