#!/usr/bin/env bash
# Shell script to set MariaDB/MySQL max_connections using mysql client.
# Usage: source .env to load variables, then run this script: ./scripts/set-max-connections.sh

HOST=${DB_HOST:-localhost}
PORT=${DB_PORT:-3306}
USER=${DB_ADMIN_USER:-root}
PASS=${DB_ADMIN_PASSWORD}
MAX=${DB_MAX_CONNECTIONS:-200}

if [ -z "$PASS" ]; then
  echo "DB_ADMIN_PASSWORD is not set. Aborting." >&2
  exit 2
fi

SQL="SET GLOBAL max_connections = ${MAX};"

echo "Applying: $SQL to $HOST:$PORT as $USER"

mysql -h "$HOST" -P "$PORT" -u "$USER" -p"$PASS" -e "$SQL"
if [ $? -eq 0 ]; then
  echo "Succeeded."
else
  echo "Failed to apply max_connections." >&2
  exit 1
fi
