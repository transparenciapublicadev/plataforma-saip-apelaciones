"""Estimate lower bounds from the dated official USD retail snapshot; no Azure mutations."""
import argparse
import json
from pathlib import Path


def estimate(hours: float, postgres_free: bool = False) -> dict:
    data = json.loads(Path(__file__).with_name('prices-eastus.json').read_text())
    meters = data['meters']
    rate = lambda key: meters[key]['retailPrice']
    # A: B2s, two 32GiB E4 disks, one held Standard public IPv4 for all 730h.
    vm_residual = 2 * rate('disk') + 730 * rate('ip')
    vm = hours * rate('vm') + vm_residual
    # B: backend1CPU/2GiB, frontend group0.75CPU/1.5GiB (Node + proxy).
    # All replicas active for the stated hours, shared free grant entirely unused.
    aca = max(0, hours * 3600 * 1.75 - 180000) * rate('cpu')
    aca += max(0, hours * 3600 * 3.5 - 360000) * rate('memory')
    pg = 0 if postgres_free else hours * rate('pg') + 32 * rate('pgStorage')
    return {'hours': hours, 'A_USD': round(vm, 2), 'A_stopped_residual_USD': round(vm_residual, 2),
            'B_USD_lower_bound': round(aca + pg, 2), 'B_Postgres_free_assumed': postgres_free,
            'excluded': 'Supabase, excess backups/IO/egress, registry/logs, private networking, domain, tax; entitlement not verified'}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--hours', nargs='+', type=float, default=[40, 160, 730])
    p.add_argument('--assume-postgres-free', action='store_true', help='Scenario only; does not verify eligibility')
    args = p.parse_args()
    if any(h < 0 or h > 730 for h in args.hours):
        p.error('Use monthly hours from0 through730')
    print(json.dumps([estimate(h, args.assume_postgres_free) for h in args.hours], indent=2))
