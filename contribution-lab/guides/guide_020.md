# Developer Guide 20: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 20.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule21 } = require('../validators/rule_021.js');
const res = validateRule21('example_token');
console.log('Result:', res);
```
