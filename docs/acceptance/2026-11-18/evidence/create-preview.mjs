import {mkdtemp} from 'node:fs/promises';
import {JsonStore} from '../../../../src/storage/json-store.js';
import {seedDemo} from '../../../../src/storage/seed.js';
import {hashPassword} from '../../../../src/auth/passwords.js';
const dir=await mkdtemp('/tmp/covershift-acceptance-');const store=new JsonStore(`${dir}/covershift.json`);await seedDemo(store);const hash=await hashPassword('Fictional acceptance review access!');
await store.transaction(db=>{for(const u of db.users)u.passwordHash=hash;const offset=Date.parse('2026-11-25T15:00:00Z')-Date.parse('2026-11-11T15:00:00Z');for(const s of db.shifts){s.startsAt=new Date(Date.parse(s.startsAt)+offset).toISOString();s.endsAt=new Date(Date.parse(s.endsAt)+offset).toISOString();}});console.log(dir);
