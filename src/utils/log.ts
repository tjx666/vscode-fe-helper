import { EXTENSION_NAME } from './constants';

function log(message: string): void {
    console.log(`[${EXTENSION_NAME}] ${new Date().toISOString()} ${message}`);
}

export { log };
