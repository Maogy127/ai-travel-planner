import {state,clone,snap,notify,listeners} from './firebase-app.js';
export const getFirestore=()=>({});
export const doc=(db,...parts)=>({path:parts.join('/')});
export const collection=(db,...parts)=>({path:parts.join('/'),collection:true});
export const serverTimestamp=()=>Date.now();
export const arrayUnion=(...values)=>({op:'union',values});
export const arrayRemove=(...values)=>({op:'remove',values});
export const deleteField=()=>({op:'delete'});
export async function getDoc(ref){state.calls.push(['get',ref.path]);return snap(ref.path);}
function validate(v,depth=0){if(v===undefined||depth>30)throw Error("Unsupported document value");if(v&&typeof v==='object')Object.values(v).forEach(x=>validate(x,depth+1));}
export async function setDoc(ref,data){validate(data);state.calls.push(['set',ref.path,clone(data)]);state.records.set(ref.path,clone(data));notify();}
export async function updateDoc(ref,data){validate(data);state.calls.push(['update',ref.path,clone(data)]);const result=clone(state.records.get(ref.path)||{});for(const [key,v] of Object.entries(data)){const keys=key.split('.');let obj=result;keys.slice(0,-1).forEach(k=>{obj=obj[k]||=( {});});const k=keys.at(-1);if(v?.op==='union')obj[k]=[...new Set([...(obj[k]||[]),...v.values])];else if(v?.op==='remove')obj[k]=(obj[k]||[]).filter(x=>!v.values.includes(x));else if(v?.op==='delete')delete obj[k];else obj[k]=clone(v);}state.records.set(ref.path,result);notify();}
export function onSnapshot(ref,fn){listeners.set(ref,fn);queueMicrotask(notify);return ()=>listeners.delete(ref);}

export async function deleteDoc(ref){state.calls.push(['delete',ref.path]);state.records.delete(ref.path);notify();}
