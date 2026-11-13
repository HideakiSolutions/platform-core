"""Revised owner acceptance cannot silently waive or erase other gates."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('srm_gate', ROOT/'scripts/validate-srm-absorption.py')
gate = importlib.util.module_from_spec(spec);spec.loader.exec_module(gate)
MATRIX = json.loads((ROOT/'docs/srm-absorption/traceability.json').read_text())
DECISIONS = json.loads((ROOT/'docs/srm-absorption/acceptance-decisions.json').read_text())

class AcceptanceTest(unittest.TestCase):
    def test_only_three_owner_dispensations_are_accepted(self):
        _, waived=gate.unresolved_gates(MATRIX['global_open_gates'],DECISIONS)
        self.assertEqual(set(waived),gate.DISPENSABLE_GATES)

    def test_identity_cannot_be_waived(self):
        gates=copy.deepcopy(MATRIX['global_open_gates'])
        next(x for x in gates if x['id']=='identity-live')['status']='WAIVED'
        with self.assertRaisesRegex(ValueError,'unauthorized'):gate.unresolved_gates(gates,DECISIONS)

    def test_gate_cannot_be_deleted(self):
        with self.assertRaisesRegex(ValueError,'required'):gate.unresolved_gates(MATRIX['global_open_gates'][:-1],DECISIONS)

    def test_test_claim_cannot_masquerade_as_dispensation(self):
        decisions=copy.deepcopy(DECISIONS);decisions['decisions'][0]['test_executed']=True
        with self.assertRaisesRegex(ValueError,'unauthorized'):gate.unresolved_gates(MATRIX['global_open_gates'],decisions)

    def test_pass_requires_evidence(self):
        gates=copy.deepcopy(MATRIX['global_open_gates'])
        entry=next(x for x in gates if x['id']=='identity-live');entry['status']='PASS';entry.pop('evidence',None)
        with self.assertRaisesRegex(ValueError,'evidence'):gate.unresolved_gates(gates,DECISIONS)

    def test_proposed_adr_cannot_satisfy_admission(self):
        with self.assertRaisesRegex(ValueError,'owner acceptance'):
            gate.require_recorded_admission({'status':'proposed','owner_acceptance':None})

    def test_exception_without_owner_approval_is_rejected(self):
        gates=copy.deepcopy(MATRIX['global_open_gates'])
        entry=next(x for x in gates if x['id']=='independent-review')
        entry.update(status='ACCEPTED_EXCEPTION',technical_review='COMPLETE',technical_findings='CLOSED',historical_process_status='NONCONFORMANT')
        decisions=copy.deepcopy(DECISIONS);decisions['closure_authorizations']=[]
        with self.assertRaisesRegex(ValueError,'owner approval'):gate.unresolved_gates(gates,decisions)

    def test_other_gates_cannot_use_process_exception(self):
        gates=copy.deepcopy(MATRIX['global_open_gates'])
        next(x for x in gates if x['id']=='identity-live')['status']='ACCEPTED_EXCEPTION'
        with self.assertRaisesRegex(ValueError,'owner approval'):gate.unresolved_gates(gates,DECISIONS)

    def test_exception_cannot_erase_historical_nonconformance(self):
        gates=copy.deepcopy(MATRIX['global_open_gates'])
        next(x for x in gates if x['id']=='independent-review').update(status='ACCEPTED_EXCEPTION',historical_process_status='PASS')
        with self.assertRaisesRegex(ValueError,'preserved history'):gate.unresolved_gates(gates,DECISIONS)

if __name__=='__main__':unittest.main()
