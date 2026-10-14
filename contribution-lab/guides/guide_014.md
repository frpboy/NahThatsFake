# Developer Guide 14: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 14.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule15 } = require('../validators/rule_015.js');
const res = validateRule15('example_token');
console.log('Result:', res);
```
