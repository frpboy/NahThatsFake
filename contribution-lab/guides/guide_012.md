# Developer Guide 12: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 12.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule13 } = require('../validators/rule_013.js');
const res = validateRule13('example_token');
console.log('Result:', res);
```
