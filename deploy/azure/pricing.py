"""Estimate lower bounds from the dated official USD retail snapshot; no Azure mutations."""
import argparse
from decimal import Decimal
import json
from pathlib import Path


def estimate(hours: float, postgres_free: bool = False, *, aca_grant: bool = False,
             ip_billed_hours: float = 730) -> dict:
    running = Decimal(str(hours))
    ip_hours = Decimal(str(ip_billed_hours))
    if not running.is_finite() or not ip_hours.is_finite() or not 0 <= running <= ip_hours <= 730:
        raise ValueError('Use finite monthly running hours from0 through730 and IP billed hours at least as large')
    data = json.loads(Path(__file__).with_name('prices-eastus.json').read_text())
    meters = data['meters']
    rate = lambda key: Decimal(str(meters[key]['retailPrice']))
    money = lambda value: float(value.quantize(Decimal('0.01')))
    # Keep the prepared two-disk baseline. IP deletion is a cost scenario only.
    disks = 2 * rate('disk')
    vm_residual = disks + (ip_hours * rate('ip') if ip_hours == 730 else 0)
    vm = running * rate('vm') + disks + ip_hours * rate('ip')
    # B: backend1CPU/2GiB, frontend group0.75CPU/1.5GiB (Node + proxy).
    # Full monthly grants are opt-in, not an account/eligibility check.
    aca = max(0, running * 3600 * Decimal('1.75') - (180000 if aca_grant else 0)) * rate('cpu')
    aca += max(0, running * 3600 * Decimal('3.5') - (360000 if aca_grant else 0)) * rate('memory')
    pg_storage = Decimal(0) if postgres_free else 32 * rate('pgStorage')
    pg = Decimal(0) if postgres_free else running * rate('pg') + pg_storage
    return {'hours': hours, 'rates_checked_on': data['checkedOn'],
            'A_USD': money(vm), 'A_stopped_residual_USD': money(vm_residual),
            'A_disks': [meters['disk']['skuName']] * 2,
            'A_ip_billed_hours_per_month': ip_billed_hours,
            'A_fixed_annual_USD': money(vm_residual * 12),
            'A_running_hours_per_year': float(running * 12),
            'A_annual_USD': money(vm * 12),
            'B_USD_lower_bound': money(aca + pg), 'B_fixed_annual_USD_lower_bound': money(pg_storage * 12),
            'B_annual_USD_lower_bound': money((aca + pg) * 12),
            'B_Postgres_free_assumed': postgres_free, 'B_aca_grant_assumed': aca_grant,
            'subscription_entitlement_verified': False,
            'annual_basis': '12 identical 730-hour months; annual totals calculated before display rounding',
            'excluded': 'Supabase, SMTP, requests, excess backups/IO/egress, registry/logs, private networking, domain, tax; PG restart/maintenance hours beyond stated hours; entitlement not verified'}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--hours', nargs='+', type=float, default=[40, 160, 730])
    p.add_argument('--assume-postgres-free', action='store_true', help='Scenario only; does not verify eligibility')
    p.add_argument('--assume-aca-grant', action='store_true', help='Assume the entire monthly grant is unused; never verifies it')
    p.add_argument('--ip-billed-hours', type=float, default=730,
                   help='Monthly charged IP hours, including allocation overhead/rounding; cost scenario only, no IP mutation')
    args = p.parse_args()
    try:
        results = [estimate(h, args.assume_postgres_free, aca_grant=args.assume_aca_grant,
                            ip_billed_hours=args.ip_billed_hours) for h in args.hours]
    except ValueError as error:
        p.error(str(error))
    print(json.dumps(results, indent=2))
