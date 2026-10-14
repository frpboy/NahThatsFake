# Developer Guide 2: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 2.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule3 } = require('../validators/rule_003.js');
const res = validateRule3('example_token');
console.log('Result:', res);
```
