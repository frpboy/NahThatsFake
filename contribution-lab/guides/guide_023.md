# Developer Guide 23: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 23.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule24 } = require('../validators/rule_024.js');
const res = validateRule24('example_token');
console.log('Result:', res);
```
