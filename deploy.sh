#!/bin/bash

# =============================================================
#  deploy.sh — Deploy and manage Smoker App on Unraid
#
#  Copy deploy.env.example to deploy.env and fill in your values.
#
#  Usage:
#    ./deploy.sh              → pull latest images and restart
#    ./deploy.sh update       → same as above
#    ./deploy.sh template     → install Docker template on Unraid
# =============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load local config
if [ ! -f "${SCRIPT_DIR}/deploy.env" ]; then
  echo "Error: deploy.env not found. Copy deploy.env.example to deploy.env and fill in your values."
  exit 1
fi
source "${SCRIPT_DIR}/deploy.env"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

update() {
  echo -e "${YELLOW}Pulling latest images from ghcr.io and restarting...${NC}"
  ssh ${UNRAID_USER}@${UNRAID_HOST} \
    "cd ${REMOTE_DIR} && docker compose pull && docker compose up -d"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Done! Stack updated successfully.${NC}"
  else
    echo -e "${RED}Update failed. Check SSH connection and container logs.${NC}"
    exit 1
  fi
}

install_template() {
  echo -e "${YELLOW}Installing Docker template...${NC}"
  rsync -v --no-perms --no-owner --no-group \
    "${SCRIPT_DIR}/unraid/smoker-app.xml" \
    ${UNRAID_USER}@${UNRAID_HOST}:${TEMPLATE_DIR}/smoker-app.xml

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Done! Refresh the Docker UI and 'smoker-app' will appear in the template dropdown.${NC}"
  else
    echo -e "${RED}Failed to copy template. Check SSH connection.${NC}"
    exit 1
  fi
}

case "${1:-update}" in
  update)   update ;;
  template) install_template ;;
  *)
    echo -e "${RED}Unknown command: $1${NC}"
    echo "Usage: ./deploy.sh [update|template]"
    exit 1
    ;;
esac
