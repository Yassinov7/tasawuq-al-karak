/** Gregorian calendar and local-wall-clock conversion. Never parse a local day as UTC. */
export type OfferCalendarDay={year:number;month:number;day:number};
export type OfferWallClock=OfferCalendarDay&{hour:number;minute:number};
const pad=(value:number)=>String(value).padStart(2,'0');
export function localOfferFields(value:string|number|Date){
 const date=value instanceof Date?value:new Date(value);
 if(!Number.isFinite(date.getTime()))throw new Error('موعد الانتهاء غير صالح.');
 return{date:`${String(date.getFullYear()).padStart(4,'0')}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`,time:`${pad(date.getHours())}:${pad(date.getMinutes())}`,year:date.getFullYear(),month:date.getMonth()+1,day:date.getDate(),hour:date.getHours(),minute:date.getMinutes()};
}
export function parseOfferDay(value:string):OfferCalendarDay{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('اختر يوم الانتهاء من التقويم.');
 const[year,month,day]=value.split('-').map(Number);
 if(year<1||year>9999||month<1||month>12||day<1||day>offerMonthDays(year,month))throw new Error('اليوم المختار غير صالح.');
 return{year,month,day};
}
export function offerMonthDays(year:number,month:number){
 if(month===2)return year%4===0&&(year%100!==0||year%400===0)?29:28;
 return[4,6,9,11].includes(month)?30:31;
}
export function offerCalendarCells(year:number,month:number):(number|null)[]{
 const first=new Date(0);first.setUTCFullYear(year,month-1,1);first.setUTCHours(12,0,0,0);
 const offset=(first.getUTCDay()+1)%7; // Calendar navigation must not depend on DST.
 return[...Array<null>(offset).fill(null),...Array.from({length:offerMonthDays(year,month)},(_,index)=>index+1)];
}
export function moveOfferMonth(year:number,month:number,delta:number){
 const absolute=year*12+month-1+delta,nextYear=Math.floor(absolute/12);
 if(nextYear<1||nextYear>9999)return{year,month};
 return{year:nextYear,month:absolute%12+1};
}
function sameWallClock(value:Date,parts:OfferWallClock){return value.getFullYear()===parts.year&&value.getMonth()+1===parts.month&&value.getDate()===parts.day&&value.getHours()===parts.hour&&value.getMinutes()===parts.minute;}
export function localOfferEndInstant(dateText:string,timeText:string):string{
 const day=parseOfferDay(dateText);
 if(!/^\d{2}:\d{2}$/.test(timeText))throw new Error('اختر الساعة والدقيقة قبل تأكيد الموعد.');
 const[hour,minute]=timeText.split(':').map(Number);
 if(hour>23||minute>59)throw new Error('الوقت المختار غير صالح.');
 const parts={...day,hour,minute};
 const date=new Date(day.year,day.month-1,day.day,hour,minute,0,0);
 if(day.year<100)date.setFullYear(day.year);
 if(!sameWallClock(date,parts))throw new Error('هذا الوقت غير موجود في توقيت جهازك بسبب تغيير الساعة. اختر وقتًا آخر.');
 // Native Date picks one occurrence of an overlapping clock time silently.
 // Enumerate surrounding timezone offsets and reject an ambiguous second occurrence.
 const wall=new Date(0);wall.setUTCFullYear(day.year,day.month-1,day.day);wall.setUTCHours(hour,minute,0,0);
 const offsets=new Set<number>();
 for(let hours=-48;hours<=48;hours+=6)offsets.add(new Date(date.getTime()+hours*3600000).getTimezoneOffset());
 const instants=new Set<number>();
 for(const offset of offsets){const candidate=new Date(wall.getTime()+offset*60000);if(sameWallClock(candidate,parts))instants.add(candidate.getTime());}
 if(instants.size!==1)throw new Error('هذا الوقت يتكرر عند تغيير الساعة. اختر وقتًا آخر خارج الفترة المكررة.');
 return date.toISOString();
}
export function validateLocalOfferEnd(date:string,time:string,now:number,startsAt?:string){
 const result=localOfferEndInstant(date,time);
 if(Date.parse(result)<=now)throw new Error('اختر تاريخًا ووقتًا في المستقبل؛ الوقت المختار مضى بالفعل.');
 if(startsAt&&Date.parse(result)<=Date.parse(startsAt))throw new Error('يجب أن يكون موعد الانتهاء بعد بداية العرض المثبتة.');
 return result;
}
export function formatLocalOfferEnd(value:string){return new Date(value).toLocaleString('ar-SY',{calendar:'gregory',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});}
export function formatCompactOfferDate(value: string) {
 const date = new Date(value);
 if (!Number.isFinite(date.getTime())) return null;
 const { day, month, year, time } = localOfferFields(date);
 return `${pad(day)}/${pad(month)}/${year} · ${time}`;
}
export function keepsSavedOfferEnd(original:string|null,date:string,time:string){
 if(!original)return false;const saved=localOfferFields(original);return saved.date===date&&saved.time===time;
}
