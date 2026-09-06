import * as pulumi from "@pulumi/pulumi";
import * as digitalocean from "@pulumi/digitalocean";

/**
 * Provisions one server per environment (Pulumi stack):
 *   development | staging | stress-test | production
 *
 * Required config (per stack):
 *   pulumi config set dropletSize s-2vcpu-4gb
 *   pulumi config set --secret sshPublicKey "ssh-ed25519 AAAA..."
 *
 * Optional config:
 *   region (default: sgp1)
 *
 * Auth: DIGITALOCEAN_TOKEN env var (or `pulumi config set digitalocean:token --secret`).
 */

const config = new pulumi.Config();
const env = pulumi.getStack();

const region = config.get("region") ?? "sgp1";
const dropletSize = config.require("dropletSize");
const sshPublicKey = config.requireSecret("sshPublicKey");
const ubuntuImage = config.get("ubuntuImage") ?? "ubuntu-24-04-x64";

// --- SSH key ---
const sshKey = new digitalocean.SshKey(`${env}-deploy-key`, {
  name: `merb-${env}`,
  publicKey: sshPublicKey,
});

// --- Droplet ---
const droplet = new digitalocean.Droplet(`merb-${env}`, {
  name: `merb-${env}`,
  image: ubuntuImage,
  size: dropletSize,
  region,
  sshKeys: [sshKey.fingerprint],
  monitoring: true,
  tags: ["merb-starterpack", `env:${env}`],
});

// --- Cloud firewall: only SSH/HTTP/HTTPS in, everything out ---
const anyWhere = ["0.0.0.0/0", "::/0"];

const firewall = new digitalocean.Firewall(`merb-${env}-fw`, {
  name: `merb-${env}`,
  dropletIds: [droplet.id.apply((id) => Number(id))],
  inboundRules: [
    { protocol: "tcp", portRange: "22", sourceAddresses: anyWhere },
    { protocol: "tcp", portRange: "80", sourceAddresses: anyWhere },
    { protocol: "tcp", portRange: "443", sourceAddresses: anyWhere },
    { protocol: "icmp", sourceAddresses: anyWhere },
  ],
  outboundRules: [
    { protocol: "tcp", portRange: "1-65535", destinationAddresses: anyWhere },
    { protocol: "udp", portRange: "1-65535", destinationAddresses: anyWhere },
    { protocol: "icmp", destinationAddresses: anyWhere },
  ],
});

// --- Outputs (consumed by the Ansible inventory generator) ---
export const ip = droplet.ipv4Address;
export const regionOut = region;
export const size = dropletSize;
export const environment = env;
export const firewallId = firewall.id;
