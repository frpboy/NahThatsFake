# Developer Guide 26: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 26.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule27 } = require('../validators/rule_027.js');
const res = validateRule27('example_token');
console.log('Result:', res);
```
