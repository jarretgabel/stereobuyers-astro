#!/usr/bin/env python3
"""Pushes the 'd' (directory page) entries from generated/redirect-kvs.json into the live CloudFront KeyValueStore.

Usage: python3 scripts/update-kvs.py <key-value-store-arn>
"""
import json
import os
import subprocess
import sys

if len(sys.argv) != 2:
    sys.exit(__doc__)
arn = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(here, '../generated/redirect-kvs.json')))['data']
keys = [x['key'] for x in data if x['value'] == 'd']

for i in range(0, len(keys), 50):
    describe = subprocess.check_output(['aws', 'cloudfront-keyvaluestore', 'describe-key-value-store', '--kvs-arn', arn])
    etag = json.loads(describe)['ETag']
    puts = json.dumps([{'Key': k, 'Value': 'd'} for k in keys[i:i + 50]])
    subprocess.check_call(['aws', 'cloudfront-keyvaluestore', 'update-keys', '--kvs-arn', arn, '--if-match', etag, '--puts', puts])
    print(f'updated {min(i + 50, len(keys))}/{len(keys)}')
