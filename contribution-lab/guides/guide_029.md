# Developer Guide 29: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 29.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule30 } = require('../validators/rule_030.js');
const res = validateRule30('example_token');
console.log('Result:', res);
```
