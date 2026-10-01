#!/usr/bin/env bash
set -e

copy_env() {
  local dir="$1"
  local example="$dir/.env.example"
  local target="$dir/.env"

  if [ ! -f "$example" ]; then
    echo "Skipping $dir: .env.example not found"
    return
  fi

  if [ -f "$target" ]; then
    echo "Skipping $dir: .env already exists"
  else
    cp "$example" "$target"
    echo "Created $target from .env.example"
  fi
}

copy_env "."
copy_env "./frontend"
copy_env "./backend"
copy_env "./instances/sprout"
