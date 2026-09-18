import {createApplication} from './app.mjs';
const app=await createApplication();
app.server.listen(app.config.port,app.config.host,()=>console.log(`Interior workspace: http://${app.config.host}:${app.config.port} (${app.repo.backend})`));
let stopping=false;async function stop(){if(stopping)return;stopping=true;app.server.close(async()=>{await app.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
