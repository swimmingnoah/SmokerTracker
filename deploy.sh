#!/bin/bash

# =============================================================
#  deploy.sh — Pull latest Docker images from ghcr.io and
#              restart containers on Unraid.
#
#  One-time setup required on Unraid first — see CLAUDE.md.
#
#  Usage:
#    ./deploy.sh          → pull latest images and restart both
#    ./deploy.sh update   → same as above
# =============================================================

UNRAID_USER="root"
UNRAID_HOST="10.0.0.3"
REMOTE_DIR="/mnt/user/appdata/smoker-app"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

update() {
  echo -e "${YELLOW}Pulling latest images from ghcr.io and restarting on Unraid...${NC}"
  ssh ${UNRAID_USER}@${UNRAID_HOST} \
    "cd ${REMOTE_DIR} && docker compose pull && docker compose up -d"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Done! Stack updated successfully.${NC}"
  else
    echo -e "${RED}Update failed. Check SSH connection and container logs on Unraid.${NC}"
    exit 1
  fi
}

case "${1:-update}" in
  update) update ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    echo "Usage: ./deploy.sh [update]"
    exit 1
    ;;
esac
