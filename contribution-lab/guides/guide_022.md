# Developer Guide 22: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 22.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule23 } = require('../validators/rule_023.js');
const res = validateRule23('example_token');
console.log('Result:', res);
```
