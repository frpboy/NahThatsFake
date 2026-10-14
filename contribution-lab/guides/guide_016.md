# Developer Guide 16: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 16.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule17 } = require('../validators/rule_017.js');
const res = validateRule17('example_token');
console.log('Result:', res);
```
