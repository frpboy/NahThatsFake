# Developer Guide 21: Subsystem Best Practices

## Overview
This guide documents integration patterns for verification module 21.

## Pattern Guidelines
- Always wrap external API calls in a retry handler with exponential backoff.
- Validate telemetry events using JSON schemas before ingestion.
- Never log plaintext secrets or sensitive tokens.

## Code Example
```javascript
const { validateRule22 } = require('../validators/rule_022.js');
const res = validateRule22('example_token');
console.log('Result:', res);
```
