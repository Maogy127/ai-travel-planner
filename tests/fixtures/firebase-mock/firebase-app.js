const root=globalThis;
const records=new Map(),listeners=new Map(),authListeners=new Set(),calls=[];
const clone=value=>JSON.parse(JSON.stringify(value));
const state={user:null,records,calls,fail:false};
function snap(path){return {id:path.split('/').pop(),exists:()=>records.has(path),data:()=>clone(records.get(path))};}
function notify(){for(const [ref,fn] of listeners){if(ref.collection)fn({docs:[...records.keys()].filter(k=>k.startsWith(ref.path+'/')&&k.split('/').length===ref.path.split('/').length+1).map(snap)});else fn(snap(ref.path));}}
const control=root.__fbMock={state,setUser(user){state.user=user;authListeners.forEach(fn=>fn(user));},seed(path,data){records.set(path,clone(data));notify();},dump(){return Object.fromEntries(records);},remote(path,data){records.set(path,{...records.get(path),...clone(data)});notify();},simulateAlex(path,title='Kualoa'){const old=records.get(path);records.set(path,{...old,lastChange:{by:'alex',text:'Alex added '+title,at:Date.now()}});notify();},failLoading(value=true){state.fail=value;}};
export function initializeApp(){if(state.fail)throw Error('blocked');return {};}
export {state,control,clone,snap,notify,listeners,authListeners};
