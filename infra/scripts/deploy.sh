#!/usr/bin/env bash
# One-command infrastructure orchestration per environment.
#
# Usage:
#   ./deploy.sh <env>               # deploy app (assumes server already provisioned)
#   ./deploy.sh <env> provision     # pulumi up + ansible provision + deploy (first time)
#   ./deploy.sh <env> destroy       # destroy cloud resources (Pulumi)
#
# Environments: development | staging | stress-test | production
#
# First-time prerequisites:
#   1. cd infra/pulumi && bun install
#   2. pulumi login && export DIGITALOCEAN_TOKEN=...
#   3. pulumi stack select development
#   4. pulumi config set dropletSize s-1vcpu-1gb      (see Pulumi.<env>.yaml)
#   5. pulumi config set --secret sshPublicKey "ssh-ed25519 ..."
#   6. cd ../ansible && ansible-vault create group_vars/development/vault.yml

set -euo pipefail

ENV="${1:-}"
ACTION="${2:-deploy}"
case "$ENV" in
  development | staging | stress-test | production) ;;
  *)
    echo "Usage: $0 <development|staging|stress-test|production> [deploy|provision|destroy]" >&2
    exit 1
    ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ANSIBLE_DIR="$ROOT/infra/ansible"
PULUMI_DIR="$ROOT/infra/pulumi"

VAULT_ARGS=()
if [[ -f "$ANSIBLE_DIR/.vault-pass" ]]; then
  VAULT_ARGS=(--vault-password-file "$ANSIBLE_DIR/.vault-pass")
else
  echo "ℹ No infra/ansible/.vault-pass found — will prompt for vault password."
fi

case "$ACTION" in
  destroy)
    cd "$PULUMI_DIR"
    pulumi destroy --stack "$ENV"
    ;;

  provision)
    echo "── 1/3 Pulumi: provisioning $ENV infrastructure ──"
    cd "$PULUMI_DIR"
    pulumi up --stack "$ENV" --yes

    echo "── 2/3 Inventory: writing server IP ──"
    "$ROOT/infra/scripts/gen-inventory.sh" "$ENV"

    echo "── 3/3 Ansible: base config + Docker (as root, first connect) ──"
    cd "$ANSIBLE_DIR"
    ansible-playbook \
      -i "inventory/$ENV/hosts.yml" \
      -i "inventory/$ENV/hosts.auto.yml" \
      -u root \
      "${VAULT_ARGS[@]}" \
      playbooks/provision.yml

    echo "── Bonus: deploying the application ──"
    ansible-playbook \
      -i "inventory/$ENV/hosts.yml" \
      -i "inventory/$ENV/hosts.auto.yml" \
      "${VAULT_ARGS[@]}" \
      playbooks/deploy.yml

    IP=$(grep ansible_host "inventory/$ENV/hosts.auto.yml" | awk '{print $2}')
    echo ""
    echo "✅ $ENV is live at http://$IP (API: http://$IP/api/health)"
    ;;

  deploy)
    echo "── Inventory ──"
    "$ROOT/infra/scripts/gen-inventory.sh" "$ENV"
    cd "$ANSIBLE_DIR"
    ansible-playbook \
      -i "inventory/$ENV/hosts.yml" \
      -i "inventory/$ENV/hosts.auto.yml" \
      "${VAULT_ARGS[@]}" \
      playbooks/deploy.yml
    echo "✅ $ENV deployed."
    ;;

  *)
    echo "Unknown action: $ACTION (use deploy|provision|destroy)" >&2
    exit 1
    ;;
esac
