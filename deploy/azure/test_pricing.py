"""Financial regression cases for the dated East US retail snapshot, not a quote."""
import json
from pathlib import Path
import subprocess
import sys
import unittest

from pricing import estimate


class PricingTests(unittest.TestCase):
    def test_prepared_fixed_cost_alone_exceeds_the_annual_credit(self):
        result = estimate(0)
        self.assertEqual(result['A_fixed_annual_USD'], 101.40)
        self.assertGreater(result['A_annual_USD'], 100)

    def test_annual_total_uses_unrounded_monthly_inputs(self):
        result = estimate(40)
        self.assertEqual(result['A_USD'], 10.11)
        self.assertEqual(result['A_running_hours_per_year'], 480)
        self.assertEqual(result['A_annual_USD'], 121.37)

    def test_releasing_ip_is_only_an_explicit_cost_scenario_not_a_disk_reduction(self):
        result = estimate(40, ip_billed_hours=40)
        self.assertEqual(result['A_fixed_annual_USD'], 57.60)
        self.assertEqual(result['A_annual_USD'], 79.97)
        self.assertEqual(result['A_disks'], ['E4 LRS', 'E4 LRS'])
        self.assertFalse(result['subscription_entitlement_verified'])

    def test_no_aca_grant_is_assumed_by_default(self):
        result = estimate(40)
        self.assertFalse(result['B_aca_grant_assumed'])
        self.assertEqual(result['B_USD_lower_bound'], 11.92)
        self.assertEqual(result['B_annual_USD_lower_bound'], 143.04)

    def test_postgres_benefit_does_not_silently_enable_aca_grants(self):
        result = estimate(40, postgres_free=True)
        self.assertEqual(result['B_USD_lower_bound'], 7.56)
        conditional = estimate(40, postgres_free=True, aca_grant=True)
        self.assertEqual(conditional['B_USD_lower_bound'], 2.16)
        self.assertEqual(conditional['B_annual_USD_lower_bound'], 25.92)
        self.assertFalse(conditional['subscription_entitlement_verified'])

    def test_invalid_or_understated_public_ip_hours_are_rejected(self):
        for hours, ip in [(41, 40), (-1, 730), (731, 730), (float('nan'), 730), (40, 731)]:
            with self.subTest(hours=hours, ip=ip), self.assertRaises(ValueError):
                estimate(hours, ip_billed_hours=ip)

    def test_cli_requires_both_assumptions_and_labels_them(self):
        result = subprocess.run([sys.executable, str(Path(__file__).with_name('pricing.py')),
                                 '--hours', '40', '--assume-postgres-free', '--assume-aca-grant'],
                                capture_output=True, text=True, check=True)
        report = json.loads(result.stdout)[0]
        self.assertTrue(report['B_Postgres_free_assumed'])
        self.assertTrue(report['B_aca_grant_assumed'])
        self.assertFalse(report['subscription_entitlement_verified'])


if __name__ == '__main__':
    unittest.main()
