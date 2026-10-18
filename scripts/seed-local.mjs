import { readFileSync } from 'node:fs';
import path from 'node:path';
import { root, accounts, password, localEnvironment, getLocalStack, runLocalSql, localRequest } from './local-env.mjs';

try {
  if (process.argv.length > 2) throw new Error('Använd npm run seed:local utan extra argument.');
  const env = localEnvironment();
  const stack = getLocalStack(env);
  const adminHeaders = { apikey: stack.serviceRole, Authorization: `Bearer ${stack.serviceRole}`, 'Content-Type': 'application/json' };
  const users = [];
  for (let page = 1; ; page++) {
    const data = await localRequest(`${stack.api}/auth/v1/admin/users?page=${page}&per_page=100`, { headers: adminHeaders });
    users.push(...data.users);
    if (data.users.length < 100) break;
  }
  const fixtures = [];
  for (const account of accounts) {
    let user = users.find(u => u.email === account.email);
    if (!user) {
      const created = await localRequest(`${stack.api}/auth/v1/admin/users`, {
        method: 'POST', headers: adminHeaders,
        body: JSON.stringify({ email: account.email, password, email_confirm: true }),
      });
      user = created.user || created;
    }
    if (!/^[0-9a-f-]{36}$/i.test(user.id)) throw new Error('Ogiltigt fixture-id från lokal Auth.');
    fixtures.push({ ...account, id: user.id });
  }
  const quote = text => "'" + text.replaceAll("'", "''") + "'";
  {
    const sql = `begin;\n${readFileSync(path.join(root, 'supabase/seed.sql'), 'utf8')}\n${readFileSync(path.join(root, 'supabase/activate_competition_bingo.sql'), 'utf8')}\n`
      + fixtures.map((u, index) => `
insert into public.profiles(id,email,display_name,is_admin,auto_elimination_recheck_after)
values(${quote(u.id)},${quote(u.email)},${quote(u.name)},${u.admin},date '2026-10-04') on conflict(id) do nothing;
insert into public.daily_results(user_id,result_date,multiplier,completed_parts)
select ${quote(u.id)}::uuid,day::date,${index + 1},array['first']::text[]
from generate_series(date '2026-10-01',date '2026-10-04',interval '1 day')day
on conflict(user_id,result_date) do nothing;
`).join('\n') + '\ncommit;';
    runLocalSql(sql, env);
  }

  // Use normal authenticated API writes for bingo, exercising the same rules as the app.
  for (let index = 0; index < fixtures.length; index++) {
    const u = fixtures[index];
    const session = await localRequest(`${stack.api}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: stack.publishable, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password }),
    });
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }).format(new Date());
    if (today >= '2026-10-05') {
      for (let cell = 0; cell <= index; cell++) {
        await localRequest(`${stack.api}/rest/v1/rpc/my_competition_bingo`, {
          method: 'POST', headers: { apikey: stack.publishable, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_action: 'complete', p_date: '2026-10-05', p_cell: cell }),
        });
      }
    }
  }
  console.log('Lokala testkonton och oktoberpass är klara. Befintliga ändringar har behållits.');
  for (const account of accounts) console.log(`${account.name}: ${account.email}`);
  console.log('Öppna http://localhost:3000/dev/login.html för testinloggning.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
