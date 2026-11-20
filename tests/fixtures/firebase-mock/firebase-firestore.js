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
// Collection reads for the community feed: query() keeps the ref; orderBy/limit are recorded, newest first.
export const orderBy=(field,dir)=>({orderBy:field,dir});
export const limit=n=>({limit:n});
export const query=(ref,...parts)=>({...ref,parts});
export async function getDocs(ref){state.calls.push(['list',ref.path]);if(state.listFail)throw Error('unavailable');const n=(ref.parts||[]).find(p=>p.limit)?.limit||1e9;const docs=[...state.records.keys()].filter(k=>k.startsWith(ref.path+'/')&&k.split('/').length===ref.path.split('/').length+1).map(snap).sort((a,b)=>(b.data().createdAt||0)-(a.data().createdAt||0)).slice(0,n);return {docs};}
export async function addDoc(ref,data){validate(data);const id='auto'+(state.records.size+1)+Math.random().toString(36).slice(2,6);state.calls.push(['add',ref.path+'/'+id,clone(data)]);state.records.set(ref.path+'/'+id,clone(data));notify();return {id};}
