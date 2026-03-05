#!/usr/bin/env bash
# Returns 0 if scheduler is running, 1 otherwise.
# Usage: ./healthcheck.sh [pid-file]

PID_FILE="${1:-logs/scheduler.pid}"

if [[ ! -f "$PID_FILE" ]]; then
  echo "WARN: PID file not found ($PID_FILE)"
  exit 1
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
  echo "OK: scheduler running (pid $PID)"
  exit 0
else
  echo "FAIL: scheduler not running (last pid $PID)"
  exit 1
fi
