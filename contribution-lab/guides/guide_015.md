# Developer Guide 15: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 15.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule16 } = require('../validators/rule_016.js');
const res = validateRule16('example_token');
console.log('Result:', res);
```
