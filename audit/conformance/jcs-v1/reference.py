"""Internal conformance oracle for the proposed audit profile; not a production SDK.

Only the integer-number subset of RFC 8785 is accepted; decimals use JSON strings.
No existing audit reader/hasher is imported, modified or selected by this tool.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import re
import sys
from pathlib import Path

PROTOCOL = 'audit-jcs-sha256/v1'
HASH = re.compile(r'[0-9a-f]{64}\Z')
STAMP = re.compile(r'(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})\Z')


def reject_number(value):
    raise ValueError('Fractional/exponent numeric lexemes are outside this profile; encode exact decimals as strings')


def integer(value):
    number = int(value)
    if abs(number) > 9007199254740991:
        raise ValueError('Integer exceeds the interoperable safe-integer profile')
    return number


def pairs(entries):
    result = {}
    for key, value in entries:
        if key in result:
            raise ValueError('Duplicate JSON property')
        result[key] = value
    return result


def scalar(value):
    if isinstance(value, str):
        # JSON can carry escaped lone surrogates, but JCS requires their rejection.
        value.encode('utf-8', errors='strict')
    elif isinstance(value, dict):
        for key, child in value.items():
            scalar(key)
            scalar(child)
    elif isinstance(value, list):
        for child in value:
            scalar(child)


def parse(raw):
    value = json.loads(raw, object_pairs_hook=pairs, parse_int=integer,
                       parse_float=reject_number, parse_constant=reject_number)
    scalar(value)
    if not isinstance(value, dict):
        raise ValueError('Audit entry must be an object')
    return value


def timestamp(value):
    match = STAMP.fullmatch(value) if isinstance(value, str) else None
    if not match:
        raise ValueError('Timestamp requires an explicit offset and at most nine fractional digits')
    day, clock, fraction, offset = match.groups()
    if offset == '-00:00':
        raise ValueError('Unknown local offset cannot establish an instant')
    if offset != 'Z' and (int(offset[1:3]) > 23 or int(offset[4:]) > 59):
        raise ValueError('Invalid numeric timezone offset')
    parsed = dt.datetime.fromisoformat(f'{day}T{clock}{"+00:00" if offset == "Z" else offset}')
    normalized = parsed.astimezone(dt.timezone.utc)
    return f'{normalized.year:04}-{normalized.month:02}-{normalized.day:02}T{normalized.hour:02}:{normalized.minute:02}:{normalized.second:02}.{(fraction or "").ljust(9, "0")}Z'


def required(value):
    if value.get('protocol') != PROTOCOL:
        raise ValueError('Unsupported explicit audit protocol')
    for key in ('audit_id', 'action', 'source'):
        if not isinstance(value.get(key), str) or not value[key]:
            raise ValueError(f'Missing or empty {key}')
    import uuid
    if str(uuid.UUID(value['audit_id'])) != value['audit_id']:
        raise ValueError('audit_id must be a canonical UUID')
    actor = value.get('actor')
    if not isinstance(actor, dict) or not isinstance(actor.get('id'), str) or not actor['id'] or actor.get('type') not in ('user', 'service', 'system'):
        raise ValueError('Invalid actor')
    if value.get('outcome') not in ('success', 'failure', 'denied'):
        raise ValueError('Unknown outcome')
    if 'prev_hash' not in value or (value['prev_hash'] is not None and not (isinstance(value['prev_hash'], str) and HASH.fullmatch(value['prev_hash']))):
        raise ValueError('prev_hash must be explicit null or lowercase SHA-256')


def canonical(value):
    if isinstance(value, dict):
        keys = sorted(value, key=lambda key: key.encode('utf-16-be'))
        return '{' + ','.join(canonical(key) + ':' + canonical(value[key]) for key in keys) + '}'
    if isinstance(value, list):
        return '[' + ','.join(canonical(child) for child in value) + ']'
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def sign(raw):
    value = parse(raw)
    if 'hash' in value:
        raise ValueError('Signing only accepts new unsigned entries; persisted/historical evidence must not be rehashed')
    required(value)
    value['timestamp'] = timestamp(value.get('timestamp'))
    content = canonical(value)
    value['hash'] = hashlib.sha256(content.encode('utf-8')).hexdigest()
    return {'entry': value, 'canonical_utf8': content, 'canonical_hex': content.encode('utf-8').hex(), 'hash': value['hash']}


def verify(raw):
    value = parse(raw)
    required(value)
    if value.get('timestamp') != timestamp(value.get('timestamp')):
        raise ValueError('Persisted timestamp is not in canonical UTC form')
    expected = value.pop('hash', None)
    if not isinstance(expected, str) or not HASH.fullmatch(expected):
        raise ValueError('Missing or invalid hash')
    actual = hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()
    if actual != expected:
        raise ValueError('Audit content hash mismatch')
    return True


def verify_chain(entries):
    if not isinstance(entries, list) or not entries:
        raise ValueError('A chain requires at least one entry')
    previous = None
    for raw in entries:
        verify(raw)
        value = parse(raw)
        if value['prev_hash'] != previous:
            raise ValueError('Predecessor does not match the preceding verified entry')
        previous = value['hash']
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--corpus', type=Path, default=Path(__file__).with_name('vectors.json'))
    args = parser.parse_args()
    raw = args.corpus.read_bytes()
    root = Path(__file__).resolve().parents[3]
    lock = json.loads(Path(__file__).with_name('corpus.lock.json').read_bytes())
    identities = {'audit/contracts/audit-event.schema.json': 'platform-core/audit/audit-event',
                  'audit/contracts/audit-chain-jcs-v1.schema.json': 'platform-core/audit/audit-chain-jcs/v1'}
    if (lock.get('schema_version') != 1 or lock.get('protocol') != PROTOCOL
            or not re.fullmatch(r'[0-9a-f]{40}', lock.get('canonical_base_revision', ''))
            or not isinstance(lock.get('schemas'), dict) or set(lock['schemas']) != set(identities)
            or not HASH.fullmatch(lock.get('corpus_sha256', ''))):
        raise ValueError('Mandatory audit corpus identities and pins are incomplete')
    if hashlib.sha256(raw).hexdigest() != lock['corpus_sha256']:
        raise ValueError('Mandatory audit corpus integrity mismatch')
    for relative, digest in lock['schemas'].items():
        source = root / relative
        if (not isinstance(digest, str) or not HASH.fullmatch(digest)
                or any(parent.is_symlink() for parent in [source, *source.parents] if parent != root and root in parent.parents)
                or hashlib.sha256(source.read_bytes()).hexdigest() != digest):
            raise ValueError('Audit contract identity/integrity mismatch')
        schema = json.loads(source.read_bytes())
        if schema.get('$id') != identities[relative] or schema.get('$schema') != 'https://json-schema.org/draft/2020-12/schema':
            raise ValueError('Unexpected audit contract identity')
    cases = json.loads(raw)
    if not cases or len({case['id'] for case in cases}) != len(cases):
        raise ValueError('Mandatory corpus must be nonempty with unique case identities')
    for case in cases:
        if case.get('operation') not in ('sign', 'verify', 'chain') or case.get('verdict') not in ('valid', 'invalid'):
            raise ValueError('Unsupported case operation/verdict')
        if not isinstance(case.get('raw'), list if case['operation'] == 'chain' else str):
            raise ValueError('Malformed case input')
        if case['operation'] == 'sign' and case['verdict'] == 'valid' and not all(isinstance(case.get(key), str) for key in ('hash', 'canonical_utf8', 'canonical_hex')):
            raise ValueError('Missing canonical-byte oracle')
    results = []
    for case in cases:
        try:
            result = sign(case['raw']) if case['operation'] == 'sign' else verify(case['raw']) if case['operation'] == 'verify' else verify_chain(case['raw']) if case['operation'] == 'chain' else (_ for _ in ()).throw(ValueError('Unknown operation'))
            passed = case['verdict'] == 'valid'
            if case['operation'] == 'sign' and passed:
                passed = all(result[key] == case[key] for key in ('hash', 'canonical_utf8', 'canonical_hex'))
        except (ValueError, TypeError, UnicodeError, OverflowError, KeyError):
            passed = case['verdict'] == 'invalid'
        results.append({'id': case['id'], 'passed': passed})
    receipt = {'protocol': PROTOCOL, 'dimension': 'behavioral-reference', 'status': 'PASS' if all(case['passed'] for case in results) else 'FAIL', 'runtime': sys.version, 'corpus_sha256': hashlib.sha256(raw).hexdigest(), 'cases_expected': len(cases), 'cases_executed': len(results), 'skips': 0, 'results': results}
    print(json.dumps(receipt, indent=2))
    return 0 if receipt['status'] == 'PASS' else 1


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, OSError, KeyError, TypeError) as error:
        print(json.dumps({'protocol': PROTOCOL, 'dimension': 'behavioral-reference',
                          'status': 'FAIL', 'runtime': sys.version, 'corpus_sha256': None,
                          'cases_expected': None, 'cases_executed': 0, 'skips': 0,
                          'results': [], 'error': str(error)}))
        raise SystemExit(1)
