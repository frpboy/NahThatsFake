# Developer Guide 7: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 7.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule8 } = require('../validators/rule_008.js');
const res = validateRule8('example_token');
console.log('Result:', res);
```
