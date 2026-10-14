# Developer Guide 17: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 17.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule18 } = require('../validators/rule_018.js');
const res = validateRule18('example_token');
console.log('Result:', res);
```
