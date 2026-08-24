import { resolve } from 'node:path';
import { StudioService } from '../../../packages/application/src/index.js';
import { JsonProjectStore } from '../../../packages/persistence/src/index.js';
import { ensureDemoProject } from './demo-project.js';

const dataDirectory = resolve(process.env.NUMBERDROID_STUDIO_DATA ?? '.numberdroid-studio');
const studio = new StudioService({ store: new JsonProjectStore({ directory: dataDirectory }) });
const project = await ensureDemoProject(studio);
process.stdout.write(`Demo project ${project.projectId} is ready at revision ${project.revision}.\n`);
