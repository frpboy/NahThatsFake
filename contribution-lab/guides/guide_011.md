# Developer Guide 11: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 11.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule12 } = require('../validators/rule_012.js');
const res = validateRule12('example_token');
console.log('Result:', res);
```
