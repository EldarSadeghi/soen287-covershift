import { store } from '../src/storage/index.js';
import { seedDemo } from '../src/storage/seed.js';
import { enableDemoAccounts } from '../src/auth/demo-accounts.js';
try {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo accounts are for local development only.');
  if (!process.env.DEMO_PASSWORD) throw new Error('Set DEMO_PASSWORD to a local demo passphrase of 15–128 characters before running this command.');
  await seedDemo(store);
  const enabled = await enableDemoAccounts(store, process.env.DEMO_PASSWORD);
  console.log(enabled.length ? `Enabled local demo accounts: ${enabled.join(', ')}` : 'Demo accounts already have passwords; no credentials changed.');
  console.log('Use the password you supplied in DEMO_PASSWORD. Passwords and hashes are not printed.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
