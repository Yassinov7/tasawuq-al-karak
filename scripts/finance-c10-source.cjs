// Source inventory only, not a PostgreSQL parser or runtime/grant verifier.
const fs=require('node:fs');
function definitions(files){const found=new Map();for(const file of files){const sql=fs.readFileSync('supabase/migrations/'+file,'utf8');
 const pattern=/create\s+(?:or\s+replace\s+)?function\s+(public|finance_private)\.(\w+)\s*\(([\s\S]*?)\)\s*returns\b([\s\S]*?)\bas\s*(\$\w*\$)/gi;
 for(const m of sql.matchAll(pattern)){const start=m.index+m[0].length,end=sql.indexOf(m[5],start);if(end<0)throw Error('Unclosed source function: '+file);found.set(m[1]+'.'+m[2],{file,line:sql.slice(0,m.index).split('\n').length,args:m[3],attributes:m[4],body:sql.slice(start,end)});}
 }return found;}
// Verification scripts here contain standard SQL literals, not dynamic/dollar-quoted programs.
function sqlCode(sql){return sql.replace(/'(?:''|[^'])*'/g,"''").replace(/--[^\n]*/g,'');}
module.exports={definitions,sqlCode};
