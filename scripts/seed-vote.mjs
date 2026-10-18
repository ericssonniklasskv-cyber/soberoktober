import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { root, localEnvironment, getLocalStack, runLocalSql } from './local-env.mjs';
try {
  const env=localEnvironment();getLocalStack(env);
  const directory=path.join(root,'supabase/local-migrations');
  const sql=readdirSync(directory).filter(file=>file.endsWith('.sql')).sort().map(file=>readFileSync(path.join(directory,file),'utf8')).join('\n');
  runLocalSql('begin;\n'+sql+'\ncommit;',env);
  console.log('Lokalt röstningstest för 19–25 oktober är klart. Befintliga röster bevaras.');
} catch(error){console.error(error.message);process.exitCode=1;}
