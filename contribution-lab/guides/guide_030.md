# Developer Guide 30: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 30.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule31 } = require('../validators/rule_031.js');
const res = validateRule31('example_token');
console.log('Result:', res);
```
