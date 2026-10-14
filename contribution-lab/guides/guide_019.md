# Developer Guide 19: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 19.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule20 } = require('../validators/rule_020.js');
const res = validateRule20('example_token');
console.log('Result:', res);
```
