# Developer Guide 27: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 27.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule28 } = require('../validators/rule_028.js');
const res = validateRule28('example_token');
console.log('Result:', res);
```
