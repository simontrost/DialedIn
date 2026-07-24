#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Diese Dateien gehörten zum vorherigen Frontendmodell und werden nicht mehr geladen.
rm -f \
  coffee-recipe-app/dialed_in/static/js/features/recipe-form.js \
  coffee-recipe-app/dialed_in/static/js/components/recipe-card.js \
  coffee-recipe-app/dialed_in/templates/dialogs/recipe_dialog.html

find coffee-recipe-app/dialed_in -type d -name __pycache__ -prune -exec rm -rf {} + 2>/dev/null || true

echo "Dialed In update prepared. Rebuild the application now."
