import type { Database } from '@/types/database';
import { profileAgeRanges, profileGenders } from '@/types/profile-demographics';
export type AccountRole = Database['public']['Enums']['account_role'];
export type PersonalDraft = Pick<Database['public']['Tables']['profiles']['Row'],'full_name'|'age_range'|'gender'>;
export const accountHome = {customer:'/home/account',merchant:'/merchant/account',driver:'/driver/account',admin:'/admin/more'} as const;
export const accountLabel = {customer:'عميل',merchant:'تاجر',driver:'سائق',admin:'مسؤول النظام'} as const;
export function personalDraft(input:PersonalDraft):PersonalDraft{return {full_name:input.full_name,age_range:input.age_range,gender:input.gender};}
export function personalValues(input:PersonalDraft):PersonalDraft {
 const full_name=input.full_name.trim();
 if(full_name.length<2||full_name.length>120)throw Error('أدخل اسمًا من حرفين إلى 120 حرفًا.');
 if(input.age_range!==null&&!profileAgeRanges.includes(input.age_range))throw Error('اختر فئة عمرية صحيحة.');
 if(input.gender!==null&&!profileGenders.includes(input.gender))throw Error('اختر قيمة صحيحة للجنس.');
 // Explicit allowlist: never forward role/email/phone or arbitrary caller properties.
 return {full_name,age_range:input.age_range,gender:input.gender};
}
export function samePersonal(a:PersonalDraft,b:PersonalDraft){return a.full_name===b.full_name&&a.age_range===b.age_range&&a.gender===b.gender;}
export function createAccountGate(){let version=0;return {next:()=>++version,valid:(token:number)=>token===version,cancel:()=>{version++;}};}

export function personalSaveResolution(current:PersonalDraft,draft:PersonalDraft,base:PersonalDraft){return samePersonal(current,personalValues(draft))?"confirmed":samePersonal(current,base)?"retry":"conflict";}
