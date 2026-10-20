let tail:Promise<unknown>=Promise.resolve();
// Prevent original-file cleanup from racing with creation of a new edit.
export function withMediaLock<T>(task:()=>Promise<T>):Promise<T>{const result=tail.then(task);tail=result.catch(()=>{});return result;}
