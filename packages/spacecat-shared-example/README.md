# Spacecat Shared - Example Wrapper

When writing universal serverless functions with Helix Universal, then `spacecat-shared-example` will wrap your function
to print a hello world.

## Usage

```js
import wrap from '@adobe/helix-shared-wrap';
import example from '@adobe-rnd/spacecat-shared-example';

...

export const main = wrap(run)
  .with(example);
```
