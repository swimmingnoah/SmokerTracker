#!/bin/bash

# =============================================================
#  deploy.sh — Deploy and manage Smoker App on Unraid
#
#  Usage:
#    ./deploy.sh              → pull latest images and restart
#    ./deploy.sh update       → same as above
#    ./deploy.sh template     → install Docker template on Unraid
#                               (makes it appear in the UI dropdown)
# =============================================================

UNRAID_USER="root"
UNRAID_HOST="YOUR_SERVER_IP"
REMOTE_DIR="/mnt/user/appdata/smoker-app"
TEMPLATE_DIR="/boot/config/plugins/dockerMan/templates-user"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

update() {
  echo -e "${YELLOW}Pulling latest images from ghcr.io and restarting...${NC}"
  ssh ${UNRAID_USER}@${UNRAID_HOST} \
    "cd ${REMOTE_DIR} && docker compose pull && docker compose up -d"

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Done! Stack updated successfully.${NC}"
  else
    echo -e "${RED}Update failed. Check SSH connection and container logs on Unraid.${NC}"
    exit 1
  fi
}

install_template() {
  echo -e "${YELLOW}Installing Docker template on Unraid...${NC}"
  rsync -av \
    "${SCRIPT_DIR}/unraid/smoker-app.xml" \
    ${UNRAID_USER}@${UNRAID_HOST}:${TEMPLATE_DIR}/smoker-app.xml

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}Done! Refresh the Unraid Docker UI and 'smoker-app' will appear in the template dropdown.${NC}"
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
