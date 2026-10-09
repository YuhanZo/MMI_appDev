#!/usr/bin/env bash
# Start the backend (:8000) and frontend (:5173) together; Ctrl+C stops both.
# Uses backend/.venv directly, so no `source .venv/bin/activate` is needed.
# Written for bash 3.2 too (macOS default): no `wait -n`, no associative arrays.
set -uo pipefail
cd "$(dirname "$0")"

fail() {
  echo "dev.sh: $*" >&2
  exit 1
}

port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null || (exec 3<>"/dev/tcp/::1/$1") 2>/dev/null
}

[[ -x backend/.venv/bin/uvicorn ]] || fail "backend/.venv is missing -- do the first-time setup in README.md"
[[ -d frontend/node_modules ]] || fail "frontend/node_modules is missing -- run 'npm install' in frontend/"
for port in 8000 5173; do
  port_in_use "$port" && fail "port $port is already in use -- is a backend or frontend already running?"
done

# Job control puts each service in its own process group, so cleanup can stop it
# together with everything it spawned (uvicorn's reloader, npm's node process).
set -m
pids=()

run() { # run NAME DIR CMD...  -- prefixes every output line with [NAME]
  local name=$1 dir=$2
  shift 2
  (cd "$dir" && "$@" 2>&1 | while IFS= read -r line; do printf '[%s] %s\n' "$name" "$line"; done) &
  pids+=($!)
}

cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]}"; do
    kill -TERM -- "-$pid" 2>/dev/null
  done
  wait 2>/dev/null
  echo "dev.sh: stopped backend and frontend"
}
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM
trap cleanup EXIT

run backend backend .venv/bin/uvicorn app.main:app --reload --port 8000
run frontend frontend npm run dev

# If either service exits (e.g. a crash), stop the other too.
while kill -0 "${pids[0]}" 2>/dev/null && kill -0 "${pids[1]}" 2>/dev/null; do
  sleep 1
done
echo "dev.sh: a service exited -- stopping the other" >&2
exit 1
